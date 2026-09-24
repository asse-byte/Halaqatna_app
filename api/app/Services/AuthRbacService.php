<?php

namespace App\Services;

use App\Models\ProgressShareLink;
use App\Models\StaffUser;
use App\Models\Student;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Auth & RBAC Service — FR1, FR2, FR3, FR16.
 * Both authentication paths terminate here and EVERY authorization decision is made here.
 * No controller or other component decides access on its own.
 */
class AuthRbacService
{
    /** Letters a child cannot confuse on paper: no I/O (1/0), no Q (O), no S (5), no Z (2). */
    public const CODE_LETTERS = 'ABCDEFGHJKLMNPRTUVWXY';
    /** Digits with no letter lookalike: no 0 (O), no 1 (I/L). */
    public const CODE_DIGITS = '23456789';
    public const MAX_ATTEMPTS = 5;                 // §5.1 NFR3a
    public const LOCKOUT_SECONDS = 15 * 60;
    public const HOURLY_MAX = 100;                 // §5.1 global secondary limit, per IP
    public const HOURLY_SECONDS = 3600;

    /**
     * §5.1 — identical message and status whether or not the identifier exists.
     * Never reveal that an email or an access code is valid.
     */
    private const GENERIC_FAILURE = 'Invalid credentials';

    public function __construct(private AuditLogger $audit) {}

    /** §5.1 — once the threshold is reached the caller is locked out; 429 for every further try. */
    private function guardAttempts(string $key, int $max): void
    {
        if (RateLimiter::tooManyAttempts($key, $max)) {
            $seconds = RateLimiter::availableIn($key);
            throw new HttpException(429, 'Too many failed attempts. Try again in '.max(1, (int) ceil($seconds / 60)).' minute(s).', null, ['Retry-After' => (string) $seconds]);
        }
    }

    /**
     * Records one failure and fails with the generic message.
     *
     * Two counters move together: the per-identity one (five tries, then a lockout) and a
     * per-IP hourly one, which is what stops a caller walking through many emails or many
     * access codes five at a time. Each writes an audit row when it trips (FR18 / UC8).
     */
    private function failAttempt(string $key, string $hourlyKey, string $scope, array $context): never
    {
        foreach ([[$key, self::MAX_ATTEMPTS, self::LOCKOUT_SECONDS, $scope], [$hourlyKey, self::HOURLY_MAX, self::HOURLY_SECONDS, $scope.'_bulk']] as [$k, $max, $decay, $name]) {
            RateLimiter::hit($k, $decay);
            if ((int) RateLimiter::attempts($k) === $max) {
                $this->audit->anonymous('CREATE', 'auth_lockout', null, $context + ['scope' => $name, 'threshold' => $max, 'lockout_seconds' => $decay]);
            }
        }
        throw new HttpException(401, self::GENERIC_FAILURE);
    }

    /**
     * A bcrypt hash of nothing in particular, checked when the email is unknown so that an
     * unknown address costs the same bcrypt round as a known one. Without it the response
     * time alone says whether an email belongs to a staff member (§5.1).
     */
    private function dummyHash(): string
    {
        static $hash;

        return $hash ??= Hash::make(bin2hex(random_bytes(16)));
    }

    // ---------- FR1: staff email + password → JWT ----------
    public function staffLogin(string $email, string $password, string $ip = '0.0.0.0'): array
    {
        $email = strtolower(trim($email));
        // Keyed on email + IP: locking on the email alone would let an attacker lock a real teacher out.
        $key = 'login:staff:'.$ip.':'.$email;
        $hourlyKey = 'login:staff:hourly:'.$ip;
        $this->guardAttempts($hourlyKey, self::HOURLY_MAX);
        $this->guardAttempts($key, self::MAX_ATTEMPTS);

        $user = StaffUser::with('role')->where('email', $email)->first();
        // The hash is always checked, and checked first. A suspended account then fails
        // exactly like an unknown one — same message, same status, same time — because a
        // distinct answer would confirm both that the email exists and that the password
        // was right (§5.1).
        $passwordOk = Hash::check($password, $user?->password_hash ?? $this->dummyHash());
        if (!$user || !$passwordOk || !$user->is_active) {
            $this->failAttempt($key, $hourlyKey, 'staff_login', ['ip' => $ip, 'email' => $email]);
        }
        RateLimiter::clear($key);

        return ['token' => $this->staffToken($user), 'user' => $user->toPublic()];
    }

    /** A fresh token for a staff user — at sign-in, and after they change their own password. */
    public function staffToken(StaffUser $user): string
    {
        return $this->issue([
            'typ' => 'staff', 'sub' => $user->user_id, 'role' => $user->roleCode(), 'circle_id' => $user->circle_id,
            'ver' => $this->credentialVersion($user->password_hash),
        ]);
    }

    // ---------- FR2 / UC24: student access code → student token ----------
    public function studentLogin(string $code, string $ip = '0.0.0.0'): array
    {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
        // §5.1 — keyed on IP only, NEVER on the access code. Locking on the code would let anyone
        // who knows a code, or who guesses codes in bulk, permanently deny that student access.
        $key = 'login:student:'.$ip;
        $hourlyKey = 'login:student:hourly:'.$ip;
        $this->guardAttempts($hourlyKey, self::HOURLY_MAX);
        $this->guardAttempts($key, self::MAX_ATTEMPTS);

        $student = Student::where('access_code', $code)->first();
        if (!$student || !$student->is_active) {
            $this->failAttempt($key, $hourlyKey, 'student_login', ['ip' => $ip]);
        }
        RateLimiter::clear($key);
        // The circle comes back with the student so the dashboard can name it straight away,
        // instead of showing a bare separator until the next page load refreshes the actor.
        return [
            'token' => $this->issue([
                'typ' => 'student', 'sub' => $student->student_id, 'circle_id' => $student->circle_id,
                'ver' => $this->credentialVersion($student->access_code),
            ]),
            'student' => $student->load('circle'),
        ];
    }

    // ---------- FR21: parent progress link — read-only, expiring, revocable ----------

    /** Only the circle's staff, and for a teacher only their own student, may issue a link. */
    public function issueShareLink(array $actor, Student $student, int $days = 30): ProgressShareLink
    {
        $this->requireStudentManagement($actor, $student);
        // One live link per student: issuing a new one retires the previous one.
        ProgressShareLink::where('student_id', $student->student_id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
        return ProgressShareLink::create([
            'student_id' => $student->student_id,
            'created_by_user_id' => $actor['id'],
            'token' => $this->shareToken(),
            'expires_at' => now()->addDays($days),
            'created_at' => now(),
        ]);
    }

    /** 32 cryptographically random bytes, base64url, 43 characters (§2.13). Never derived from student_id. */
    public function shareToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    /**
     * The token is the only credential. Unknown, expired and revoked tokens are
     * indistinguishable — all 404, so a caller is never told that a link ever existed.
     */
    public function resolveShareToken(string $token): ProgressShareLink
    {
        $link = ProgressShareLink::where('token', $token)->first();
        if (!$link || !$link->isActive()) {
            throw new HttpException(404, 'Not found');
        }
        return $link;
    }

    /** The teacher who owns the student, or the circle's supervisor, may revoke a link. */
    public function requireShareLinkControl(array $actor, ProgressShareLink $link): void
    {
        $this->requireStudentManagement($actor, $link->student()->firstOrFail());
    }

    // ---------- FR3: generate / regenerate access code (single-purpose, revocable) ----------

    /**
     * Three letters then three digits, e.g. "HKM482" — short enough for a child to
     * remember for a month, and drawn from an alphabet with no lookalike characters.
     *
     * The eight-character random string it replaces was the reason teachers regenerated a
     * code at almost every sign-in, which defeated FR3: a code nobody can retain is a code
     * that has to be reissued, and the student is locked out whenever the teacher is away.
     *
     * The shorter code is a deliberate trade of keyspace for usability, and it is safe only
     * because guessing is bounded elsewhere: MAX_ATTEMPTS failures lock an IP out for
     * LOCKOUT_SECONDS, and HOURLY_MAX caps an IP at 100 tries an hour, so the
     * ~9.3 million combinations cannot be walked. The code still grants nothing but one
     * student's own read-only dashboard (FR16) and stays revocable on demand (NFR3).
     */
    public function generateAccessCode(): string
    {
        $pick = fn (string $set) => $set[random_int(0, strlen($set) - 1)];
        do {
            $code = '';
            for ($i = 0; $i < 3; $i++) $code .= $pick(self::CODE_LETTERS);
            for ($i = 0; $i < 3; $i++) $code .= $pick(self::CODE_DIGITS);
        } while (Student::where('access_code', $code)->exists());
        return $code;
    }

    /**
     * Issues a fresh code and starts the monthly rotation clock. The old code stops working
     * at once, and so does every token signed in with it (see credentialVersion()).
     */
    public function rotateAccessCode(Student $student): string
    {
        $student->access_code = $this->generateAccessCode();
        $student->access_code_issued_at = now();
        $student->save();

        return $student->access_code;
    }

    // ---------- Token handling ----------

    /**
     * The HS256 signing key. firebase/php-jwt refuses a key shorter than the hash (32 bytes),
     * which would surface as an opaque 500 on the first sign-in; say what is wrong instead.
     */
    private function secret(): string
    {
        $secret = (string) config('halaqtna.jwt.secret');
        if (strlen($secret) < 32) {
            throw new \RuntimeException('JWT_SECRET must be set to a random string of at least 32 characters.');
        }

        return $secret;
    }

    /**
     * A short fingerprint of the credential a token was issued against — the password hash
     * for staff, the access code for a student. It is keyed with the JWT secret, so it
     * reveals nothing about the credential.
     *
     * resolveActor() recomputes it on every request, which is what makes a password change,
     * a password reset by a supervisor, or an access-code rotation sign out every device
     * that was using the old credential. Without it a leaked code stayed usable for the
     * whole token lifetime after the teacher had "revoked" it (NFR3).
     */
    private function credentialVersion(string $credential): string
    {
        return substr(hash_hmac('sha256', $credential, $this->secret()), 0, 16);
    }

    private function issue(array $claims): string
    {
        $now = time();
        $payload = $claims + ['iat' => $now, 'exp' => $now + 60 * (int) config('halaqtna.jwt.ttl_minutes', 720), 'iss' => 'halaqtna'];

        return JWT::encode($payload, $this->secret(), 'HS256');
    }

    public function resolveActor(Request $request): array
    {
        $header = $request->header('Authorization', '');
        if (!str_starts_with($header, 'Bearer ')) {
            throw new HttpException(401, 'Not authenticated');
        }
        $secret = $this->secret();
        try {
            $payload = (array) JWT::decode(substr($header, 7), new Key($secret, 'HS256'));
        } catch (\Throwable $e) {
            throw new HttpException(401, 'Invalid or expired token');
        }
        $type = $payload['typ'] ?? '';
        $version = (string) ($payload['ver'] ?? '');

        if ($type === 'staff') {
            $user = StaffUser::with('role')->find($payload['sub'] ?? null);
            if (!$user || !$user->is_active || !hash_equals($this->credentialVersion($user->password_hash), $version)) {
                throw new HttpException(401, 'Session expired — please sign in again');
            }

            return ['type' => 'staff', 'id' => $user->user_id, 'role' => $user->roleCode(), 'circle_id' => $user->circle_id, 'model' => $user];
        }
        if ($type === 'student') {
            $student = Student::find($payload['sub'] ?? null);
            if (!$student || !$student->is_active || !hash_equals($this->credentialVersion($student->access_code), $version)) {
                throw new HttpException(401, 'Session expired — please sign in again');
            }

            return ['type' => 'student', 'id' => $student->student_id, 'role' => 'STUDENT', 'circle_id' => $student->circle_id, 'model' => $student];
        }
        throw new HttpException(401, 'Invalid token type');
    }

    // ---------- Authorization decisions ----------
    public function requireRole(array $actor, array $roles): void
    {
        if (!in_array($actor['role'], $roles, true)) {
            throw new HttpException(403, 'Forbidden for role '.$actor['role']);
        }
    }

    public function isStaff(array $actor): bool { return $actor['type'] === 'staff'; }

    /**
     * FR19 / UC1–UC3, UC8 — deployment administration: circles, circle supervisors,
     * system settings and the audit trail. This is the whole of the System Administrator's
     * remit in Table 1.1 and the only place the role is allowed through.
     */
    public function requireDeploymentAdmin(array $actor): void
    {
        $this->requireRole($actor, ['SYS_ADMIN']);
    }

    /**
     * Circle-scoped operational data: roster, sessions, metrics, reports, leaderboards.
     *
     * The System Administrator is refused here. Table 1.1 gives that role control of the
     * deployment — it creates circles and assigns a Circle Supervisor to each — while the
     * Supervisor is the one who manages the teachers, the students and everything measured
     * about them. Letting the deployment administrator read a student's recitation history
     * would put a person with no pedagogical relationship to the circle inside FR16's
     * privacy boundary, so the two remits are kept disjoint rather than nested.
     */
    public function requireCircleAccess(array $actor, int $circleId): void
    {
        if ($actor['role'] === 'SYS_ADMIN') {
            throw new HttpException(403, 'A System Administrator manages circles and supervisors, not circle data');
        }
        if ((int) $actor['circle_id'] !== $circleId) {
            throw new HttpException(403, 'Access to another circle is not permitted');
        }
    }

    /**
     * Detailed student data (FR16). A student may read only their own; a Circle Admin only
     * their own circle; a Teacher only the students assigned to them — the §9 RBAC matrix
     * requires "Teacher → another teacher's student → 403", not merely a circle check.
     */
    public function requireStudentAccess(array $actor, Student $student): void
    {
        if ($actor['type'] === 'student') {
            if ((int) $actor['id'] !== (int) $student->student_id) throw new HttpException(403, 'Students may only access their own data');
            return;
        }
        $this->requireAssignedStaff($actor, $student);
    }

    /** Writes on a student (sessions, access code, roster edits): the circle's supervisor, or an assigned teacher. */
    public function requireStudentManagement(array $actor, Student $student): void
    {
        if ($actor['type'] !== 'staff') throw new HttpException(403, 'Staff only');
        $this->requireAssignedStaff($actor, $student);
    }

    /** The student's circle, and for a teacher the student must also be one of theirs (§9 RBAC matrix). */
    private function requireAssignedStaff(array $actor, Student $student): void
    {
        $this->requireCircleAccess($actor, (int) $student->circle_id);
        if ($actor['role'] === 'TEACHER' && !$student->teachers()->where('staff_user.user_id', $actor['id'])->exists()) {
            throw new HttpException(403, 'This student is not assigned to you');
        }
    }

    /**
     * Staff scope used for circle-entity list queries (FR19 needs "all circles" for the
     * System Administrator). It is never used to scope student or performance data —
     * those go through requireCircleAccess, which refuses that role outright.
     */
    public function scopeCircleId(array $actor): ?int
    {
        return $actor['role'] === 'SYS_ADMIN' ? null : (int) $actor['circle_id'];
    }
}
