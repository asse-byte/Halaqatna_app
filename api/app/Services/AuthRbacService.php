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
    public const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    public const MAX_ATTEMPTS = 5;                 // §5.1 NFR3a
    public const LOCKOUT_SECONDS = 15 * 60;
    public const STUDENT_HOURLY_MAX = 100;         // §5.1 global secondary limit, per IP
    public const STUDENT_HOURLY_SECONDS = 3600;

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

    /** Records one failure and fails with the generic message. Writes an audit row when the lockout trips. */
    private function failAttempt(string $key, int $max, string $scope, array $context): never
    {
        RateLimiter::hit($key, self::LOCKOUT_SECONDS);
        if (RateLimiter::attempts($key) >= $max) {
            // FR18 / UC8 — every lockout is visible to a System Administrator.
            $this->audit->anonymous('CREATE', 'auth_lockout', null, $context + ['scope' => $scope, 'threshold' => $max, 'lockout_seconds' => self::LOCKOUT_SECONDS]);
        }
        throw new HttpException(401, self::GENERIC_FAILURE);
    }

    // ---------- FR1: staff email + password → JWT ----------
    public function staffLogin(string $email, string $password, string $ip = '0.0.0.0'): array
    {
        $email = strtolower(trim($email));
        // Keyed on email + IP: locking on the email alone would let an attacker lock a real teacher out.
        $key = 'login:staff:'.$ip.':'.$email;
        $context = ['ip' => $ip, 'email' => $email];
        $this->guardAttempts($key, self::MAX_ATTEMPTS);

        $user = StaffUser::with('role')->where('email', $email)->first();
        // A suspended account fails exactly like an unknown one — a distinct 403 would confirm
        // both that the email exists and that the password was correct (§5.1).
        if (!$user || !$user->is_active || !Hash::check($password, $user->password_hash)) {
            $this->failAttempt($key, self::MAX_ATTEMPTS, 'staff_login', $context);
        }
        RateLimiter::clear($key);
        return ['token' => $this->issue(['typ' => 'staff', 'sub' => $user->user_id, 'role' => $user->roleCode(), 'circle_id' => $user->circle_id]), 'user' => $user->toPublic()];
    }

    // ---------- FR2 / UC24: student access code → student token ----------
    public function studentLogin(string $code, string $ip = '0.0.0.0'): array
    {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
        // §5.1 — keyed on IP only, NEVER on the access code. Locking on the code would let anyone
        // who knows a code, or who guesses codes in bulk, permanently deny that student access.
        $key = 'login:student:'.$ip;
        $bulkKey = 'login:student:hourly:'.$ip;
        $context = ['ip' => $ip];
        $this->guardAttempts($bulkKey, self::STUDENT_HOURLY_MAX);
        $this->guardAttempts($key, self::MAX_ATTEMPTS);

        $student = Student::where('access_code', $code)->first();
        if (!$student || !$student->is_active) {
            // Secondary limit: blunts bulk code guessing spread across many students.
            RateLimiter::hit($bulkKey, self::STUDENT_HOURLY_SECONDS);
            if (RateLimiter::attempts($bulkKey) >= self::STUDENT_HOURLY_MAX) {
                $this->audit->anonymous('CREATE', 'auth_lockout', null, $context + ['scope' => 'student_login_bulk', 'threshold' => self::STUDENT_HOURLY_MAX, 'lockout_seconds' => self::STUDENT_HOURLY_SECONDS]);
            }
            $this->failAttempt($key, self::MAX_ATTEMPTS, 'student_login', $context);
        }
        RateLimiter::clear($key);
        return ['token' => $this->issue(['typ' => 'student', 'sub' => $student->student_id, 'circle_id' => $student->circle_id]), 'student' => $student];
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

    /** The teacher who owns the student (or the circle admin / Sys Admin) may revoke a link. */
    public function requireShareLinkControl(array $actor, ProgressShareLink $link): void
    {
        $this->requireStudentManagement($actor, $link->student()->firstOrFail());
    }

    // ---------- FR3: generate / regenerate access code (single-purpose, revocable) ----------
    public function generateAccessCode(): string
    {
        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
        } while (Student::where('access_code', $code)->exists());
        return $code;
    }

    // ---------- Token handling ----------
    private function issue(array $claims): string
    {
        $now = time();
        $payload = $claims + ['iat' => $now, 'exp' => $now + 60 * (int) env('JWT_TTL_MINUTES', 720), 'iss' => 'halaqtna'];
        return JWT::encode($payload, env('JWT_SECRET'), 'HS256');
    }

    public function resolveActor(Request $request): array
    {
        $header = $request->header('Authorization', '');
        if (!str_starts_with($header, 'Bearer ')) {
            throw new HttpException(401, 'Not authenticated');
        }
        try {
            $payload = (array) JWT::decode(substr($header, 7), new Key(env('JWT_SECRET'), 'HS256'));
        } catch (\Throwable $e) {
            throw new HttpException(401, 'Invalid or expired token');
        }
        if (($payload['typ'] ?? '') === 'staff') {
            $user = StaffUser::with('role')->find($payload['sub']);
            if (!$user || !$user->is_active) throw new HttpException(401, 'User not found or suspended');
            return ['type' => 'staff', 'id' => $user->user_id, 'role' => $user->roleCode(), 'circle_id' => $user->circle_id, 'model' => $user];
        }
        if (($payload['typ'] ?? '') === 'student') {
            $student = Student::find($payload['sub']);
            if (!$student || !$student->is_active) throw new HttpException(401, 'Student not found or suspended');
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

    /** A Circle Admin / Teacher may only touch their own circle. Sys Admin may touch any. */
    public function requireCircleAccess(array $actor, int $circleId): void
    {
        if ($actor['role'] === 'SYS_ADMIN') return;
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
            if ($actor['id'] !== $student->student_id) throw new HttpException(403, 'Students may only access their own data');
            return;
        }
        $this->requireCircleAccess($actor, (int) $student->circle_id);
        if ($actor['role'] === 'TEACHER' && !$student->teachers()->where('staff_user.user_id', $actor['id'])->exists()) {
            throw new HttpException(403, 'This student is not assigned to you');
        }
    }

    /** Writes on a student (sessions, access code, roster edits): Sys Admin, the circle's admin, or an assigned teacher. */
    public function requireStudentManagement(array $actor, Student $student): void
    {
        if ($actor['type'] !== 'staff') throw new HttpException(403, 'Staff only');
        if ($actor['role'] === 'SYS_ADMIN') return;
        $this->requireCircleAccess($actor, (int) $student->circle_id);
        if ($actor['role'] === 'TEACHER' && !$student->teachers()->where('staff_user.user_id', $actor['id'])->exists()) {
            throw new HttpException(403, 'This student is not assigned to you');
        }
    }

    /** Staff scope used for roster/list queries. Returns null for "all circles". */
    public function scopeCircleId(array $actor): ?int
    {
        return $actor['role'] === 'SYS_ADMIN' ? null : (int) $actor['circle_id'];
    }
}
