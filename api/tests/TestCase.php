<?php

namespace Tests;

use App\Models\Circle;
use App\Models\ErrorType;
use App\Models\Role;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    /**
     * Shared world for the feature tests (§9, I1 deliverable): two circles, two teachers
     * and three students, so every role × boundary in the RBAC matrix is crossable.
     *
     *   c1 — admin1, t1 (teaches s1), t2 (teaches s2), students s1 + s2
     *   c2 — admin2, students s3
     *   sys — System Administrator, no circle
     */
    protected Circle $c1;
    protected Circle $c2;
    protected StaffUser $sys;
    protected StaffUser $admin1;
    protected StaffUser $admin2;
    protected StaffUser $t1;
    protected StaffUser $t2;
    protected Student $s1;
    protected Student $s2;
    protected Student $s3;

    protected const PASSWORD = 'secret1';

    protected function seedWorld(): void
    {
        // The ML service is a separate container; feature tests must pass without it (UC13).
        Http::fake(['*' => Http::response(['message' => 'ml down'], 503)]);
        $this->flushRateLimiters();

        foreach ([['SYS_ADMIN', 'System Administrator'], ['CIRCLE_ADMIN', 'Circle Administrator'], ['TEACHER', 'Teacher']] as [$code, $label]) {
            Role::create(['code' => $code, 'label' => $label]);
        }
        // §2.6 seed — provisional weights, calibrated in CPIT-499.
        foreach ([['MEM_GAP', 0.85], ['LNK_ERR', 0.50], ['TAJ_ERR', 0.25], ['SLF_CRT', 0.05]] as [$code, $w]) {
            ErrorType::create(['code' => $code, 'label_ar' => $code, 'label_en' => $code, 'weight' => $w]);
        }
        SystemSetting::create(['setting_key' => 'd_max', 'setting_value' => '3.0']);
        SystemSetting::create(['setting_key' => 'alpha', 'setting_value' => '0.4']);

        $this->c1 = Circle::create(['name' => 'C1']);
        $this->c2 = Circle::create(['name' => 'C2']);
        $this->sys = $this->staff('sys@x.sa', 'SYS_ADMIN', null);
        $this->admin1 = $this->staff('a1@x.sa', 'CIRCLE_ADMIN', $this->c1->circle_id);
        $this->admin2 = $this->staff('a2@x.sa', 'CIRCLE_ADMIN', $this->c2->circle_id);
        $this->t1 = $this->staff('t1@x.sa', 'TEACHER', $this->c1->circle_id);
        $this->t2 = $this->staff('t2@x.sa', 'TEACHER', $this->c1->circle_id);
        $this->s1 = Student::create(['name' => 'S1 Alpha', 'access_code' => 'AAAA1111', 'circle_id' => $this->c1->circle_id]);
        $this->s2 = Student::create(['name' => 'S2 Beta', 'access_code' => 'BBBB2222', 'circle_id' => $this->c1->circle_id]);
        $this->s3 = Student::create(['name' => 'S3 Gamma', 'access_code' => 'CCCC3333', 'circle_id' => $this->c2->circle_id]);
        $this->s1->teachers()->attach($this->t1->user_id);
        $this->s2->teachers()->attach($this->t2->user_id);
    }

    protected function staff(string $email, string $role, ?int $circle): StaffUser
    {
        return StaffUser::create([
            'name' => $email, 'email' => $email, 'password_hash' => Hash::make(self::PASSWORD),
            'role_id' => Role::where('code', $role)->value('role_id'), 'circle_id' => $circle,
        ]);
    }

    /**
     * Re-point the faked HTTP boundary (the ML container, rule 6).
     *
     * A second `Http::fake()` only APPENDS stubs and the first matching one wins, so the
     * catch-all registered by seedWorld() would shadow anything added later. Rebuilding the
     * factory is what actually changes the answer — needed by any test that wants the ML
     * service to be reachable rather than down.
     */
    protected function fakeHttp(array $stubs): void
    {
        $this->app->forgetInstance(\Illuminate\Http\Client\Factory::class);
        Http::clearResolvedInstances();
        Http::fake($stubs);
    }

    /** The login throttles are cache-backed and survive between tests in the same process. */
    protected function flushRateLimiters(): void
    {
        foreach (['sys@x.sa', 'a1@x.sa', 'a2@x.sa', 't1@x.sa', 't2@x.sa', 'nobody@x.sa'] as $email) {
            RateLimiter::clear('login:staff:127.0.0.1:'.$email);
        }
        RateLimiter::clear('login:staff:hourly:127.0.0.1');
        RateLimiter::clear('login:student:127.0.0.1');
        RateLimiter::clear('login:student:hourly:127.0.0.1');
    }

    protected function token(string $email): string
    {
        return $this->postJson('/api/auth/login', ['email' => $email, 'password' => self::PASSWORD])->assertOk()->json('token');
    }

    protected function studentToken(string $code): string
    {
        return $this->postJson('/api/auth/student-login', ['access_code' => $code])->assertOk()->json('token');
    }

    /**
     * Act as one actor. withHeader() mutates the default headers for the rest of the test,
     * so the previous actor's token is flushed first — otherwise a later "unauthenticated"
     * request would silently still carry it and a 401 assertion would never be reached.
     */
    protected function as(string $token): static
    {
        return $this->flushHeaders()->withHeader('Authorization', 'Bearer '.$token);
    }

    /** No Authorization header at all. */
    protected function asGuest(): static
    {
        return $this->flushHeaders();
    }

    /** POST /api/sessions as the teacher who owns the student. */
    protected function logSession(string $teacherToken, int $studentId, string $date, float $pages, array $errorTypeIds = [], string $attendance = 'P'): TestResponse
    {
        return $this->as($teacherToken)->postJson('/api/sessions', [
            'student_id' => $studentId, 'session_date' => $date, 'attendance_status' => $attendance, 'pages_memorized' => $pages,
            'errors' => array_map(fn ($id) => ['error_type_id' => $id, 'ayah_ref' => '18:23'], $errorTypeIds),
        ]);
    }
}
