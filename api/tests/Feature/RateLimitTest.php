<?php

namespace Tests\Feature;

use App\Services\AuthRbacService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * NFR3a / §5.1 — brute-force protection. This is the §10 "Rate limiting" checklist.
 *
 * An 8-character access code is a weaker credential than a password, and rate limiting is
 * what makes it acceptable — so the *keying* matters as much as the threshold.
 */
class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    private function staffAttempt(string $email, string $password, string $ip = '127.0.0.1')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/auth/login', ['email' => $email, 'password' => $password]);
    }

    private function studentAttempt(string $code, string $ip = '127.0.0.1')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/auth/student-login', ['access_code' => $code]);
    }

    /**
     * §5.1 / NFR3a — the throttle is cache-backed and the deployed cache store is `database`,
     * so the cache tables must exist or BOTH login endpoints 500 on a fresh deployment.
     *
     * The suite itself runs on the `array` store (phpunit.xml), which is precisely why this
     * has to be asserted explicitly: a missing migration is invisible to every other test here.
     */
    public function test_the_database_cache_store_that_backs_the_throttle_is_migrated(): void
    {
        foreach (['cache', 'cache_locks'] as $table) {
            $this->assertTrue(
                \Illuminate\Support\Facades\Schema::hasTable($table),
                "Missing `{$table}` table: CACHE_STORE=database backs the §5.1 rate limiter, so "
                .'login would fail with "no such table" on a fresh deployment.'
            );
        }

        // The driver must actually work end to end, not merely have a table.
        $store = \Illuminate\Support\Facades\Cache::store('database');
        $store->put('halaqtna-throttle-probe', 'ok', 60);
        $this->assertSame('ok', $store->get('halaqtna-throttle-probe'));
    }

    public function test_sixth_failed_staff_login_is_locked_out_for_fifteen_minutes(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->staffAttempt('a1@x.sa', 'bad')->assertStatus(401);
        }
        // Even the CORRECT password is refused once the lockout is in force.
        $locked = $this->staffAttempt('a1@x.sa', self::PASSWORD)->assertStatus(429);
        $this->assertGreaterThan(0, (int) $locked->headers->get('Retry-After'));
        $this->assertLessThanOrEqual(AuthRbacService::LOCKOUT_SECONDS, (int) $locked->headers->get('Retry-After'));
    }

    /**
     * §5.1 — the staff key is email + IP. An attacker hammering from one address must not
     * be able to lock a real teacher out of their own account from somewhere else.
     */
    public function test_staff_lockout_keys_on_email_plus_ip(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->staffAttempt('a1@x.sa', 'bad', '203.0.113.9');
        }
        $this->staffAttempt('a1@x.sa', 'bad', '203.0.113.9')->assertStatus(429);
        // The real account holder, from their own address, is unaffected.
        $this->staffAttempt('a1@x.sa', self::PASSWORD, '198.51.100.4')->assertOk();
    }

    /**
     * §5.1 — the student key is the IP, NEVER the access code. Lock the source, not the victim:
     * otherwise anyone who knows a student's code could permanently deny that student access.
     */
    public function test_student_lockout_keys_on_ip_only_so_a_known_code_cannot_lock_its_owner_out(): void
    {
        // An attacker who knows AAAA1111 burns the limit from their own address…
        for ($i = 0; $i < 6; $i++) {
            $this->studentAttempt('WRONGCOD', '203.0.113.9');
        }
        $this->studentAttempt('AAAA1111', '203.0.113.9')->assertStatus(429);
        // …and the student still logs in normally from theirs.
        $this->studentAttempt('AAAA1111', '198.51.100.4')->assertOk();
    }

    /** §5.1 — identical message and status whether or not the identifier exists. */
    public function test_failure_message_and_status_are_identical_for_valid_and_invalid_identifiers(): void
    {
        $realEmailWrongPassword = $this->staffAttempt('a1@x.sa', 'bad')->assertStatus(401);
        $unknownEmail = $this->staffAttempt('ghost@x.sa', 'bad')->assertStatus(401);
        $this->assertSame($unknownEmail->json('message'), $realEmailWrongPassword->json('message'));
        $this->assertSame($unknownEmail->getStatusCode(), $realEmailWrongPassword->getStatusCode());

        $this->flushRateLimiters();
        // The student endpoint must not reveal that a code is real either. A valid code that is
        // suspended and a code that never existed produce the same 401 and the same message.
        $this->s1->update(['is_active' => false]);
        $suspended = $this->studentAttempt('AAAA1111')->assertStatus(401);
        $unknownCode = $this->studentAttempt('ZZZZ9999')->assertStatus(401);
        $this->assertSame($unknownCode->json('message'), $suspended->json('message'));
    }

    /** §5.1 / FR18 / UC8 — every lockout is visible to a System Administrator. */
    public function test_every_lockout_writes_an_audit_row(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->staffAttempt('a1@x.sa', 'bad');
        }
        $this->assertDatabaseHas('audit_log', ['entity' => 'auth_lockout', 'action' => 'CREATE', 'actor_user_id' => null]);

        $this->flushRateLimiters();
        for ($i = 0; $i < 5; $i++) {
            $this->studentAttempt('ZZZZ9999');
        }
        $rows = \App\Models\AuditLog::where('entity', 'auth_lockout')->get();
        $this->assertContains('staff_login', $rows->pluck('payload_json.scope')->all());
        $this->assertContains('student_login', $rows->pluck('payload_json.scope')->all());

        // A System Administrator can read them; nobody else can (FR18).
        $this->as($this->token('sys@x.sa'))->getJson('/api/audit?entity=auth_lockout')->assertOk();
    }

    /** §5.1 — a global secondary limit per IP blunts bulk code guessing across many students. */
    public function test_student_login_has_a_global_hourly_limit_per_ip(): void
    {
        $this->assertSame(100, AuthRbacService::HOURLY_MAX);
        $ip = '203.0.113.50';
        // Drive the hourly counter to its ceiling directly; the per-15-minute limit would
        // otherwise stop the test long before 100 requests are made.
        RateLimiter::clear('login:student:hourly:'.$ip);
        for ($i = 0; $i < AuthRbacService::HOURLY_MAX; $i++) {
            RateLimiter::hit('login:student:hourly:'.$ip, AuthRbacService::HOURLY_SECONDS);
        }
        // Even a VALID code is refused from that address once the hourly ceiling is reached.
        $this->studentAttempt('AAAA1111', $ip)->assertStatus(429);
    }

    public function test_a_successful_login_clears_the_counter(): void
    {
        $this->staffAttempt('a1@x.sa', 'bad')->assertStatus(401);
        $this->staffAttempt('a1@x.sa', 'bad')->assertStatus(401);
        $this->staffAttempt('a1@x.sa', self::PASSWORD)->assertOk();
        for ($i = 0; $i < 4; $i++) {
            $this->staffAttempt('a1@x.sa', 'bad')->assertStatus(401);
        }
        $this->staffAttempt('a1@x.sa', self::PASSWORD)->assertOk();
    }
}
