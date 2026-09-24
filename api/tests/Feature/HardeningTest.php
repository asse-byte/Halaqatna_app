<?php

namespace Tests\Feature;

use App\Models\RecitationSession;
use App\Models\SessionError;
use App\Models\SystemSetting;
use App\Models\XpLedger;
use App\Providers\AppServiceProvider;
use App\Services\AuthRbacService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * The defects found by the full code review, each pinned by the test that would have caught
 * it: credentials that outlived their revocation, a proxy that hid every client behind one
 * address, settings that could break every metric, and XP that depended on the order in
 * which a teacher took the register and heard the recitation.
 */
class HardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
        SystemSetting::create(['setting_key' => 'xp_per_page', 'setting_value' => '10']);
        SystemSetting::create(['setting_key' => 'xp_per_session', 'setting_value' => '5']);
    }

    private function day(int $daysAgo): string
    {
        return now()->subDays($daysAgo)->toDateString();
    }

    private function xp(): int
    {
        return (int) XpLedger::where('student_id', $this->s1->student_id)->sum('points');
    }

    // ---- NFR3: a revoked credential takes its tokens with it ----

    public function test_changing_a_password_signs_out_other_devices_but_not_this_one(): void
    {
        $other = $this->token('t1@x.sa');
        $this_ = $this->token('t1@x.sa');

        $fresh = $this->as($this_)->postJson('/api/me/password', [
            'current_password' => self::PASSWORD, 'new_password' => 'NewPass2026', 'new_password_confirmation' => 'NewPass2026',
        ])->assertOk()->json('token');

        $this->as($other)->getJson('/api/auth/me')->assertStatus(401);
        $this->as($this_)->getJson('/api/auth/me')->assertStatus(401);
        $this->as($fresh)->getJson('/api/auth/me')->assertOk();
    }

    public function test_a_supervisor_resetting_a_password_signs_the_teacher_out(): void
    {
        $teacher = $this->token('t1@x.sa');
        $this->as($this->token('a1@x.sa'))->patchJson("/api/staff/{$this->t1->user_id}", ['password' => 'Reset2026!'])->assertOk();

        $this->as($teacher)->getJson('/api/students')->assertStatus(401);
    }

    public function test_rotating_an_access_code_signs_out_whoever_used_the_old_one(): void
    {
        $student = $this->studentToken('AAAA1111');
        $this->as($student)->getJson('/api/auth/me')->assertOk();

        $new = $this->as($this->token('t1@x.sa'))->postJson("/api/students/{$this->s1->student_id}/access-code")->assertOk()->json('access_code');

        $this->as($student)->getJson("/api/students/{$this->s1->student_id}/metrics")->assertStatus(401);
        $this->flushRateLimiters();
        $this->as($this->studentToken($new))->getJson("/api/students/{$this->s1->student_id}/metrics")->assertOk();
    }

    // ---- NFR3a: password spraying across many emails from one address ----

    public function test_staff_login_has_an_hourly_limit_per_ip_across_emails(): void
    {
        $ip = '198.51.100.9';
        RateLimiter::clear('login:staff:hourly:'.$ip);
        for ($i = 0; $i < AuthRbacService::HOURLY_MAX; $i++) {
            RateLimiter::hit('login:staff:hourly:'.$ip, AuthRbacService::HOURLY_SECONDS);
        }

        // A different email, and even the right password: the address itself is spent.
        $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/auth/login', ['email' => 'a1@x.sa', 'password' => self::PASSWORD])
            ->assertStatus(429);
    }

    // ---- behind nginx: the client's address and scheme come from the proxy ----

    public function test_behind_a_trusted_proxy_the_client_ip_and_https_are_honoured(): void
    {
        config(['halaqtna.trusted_proxies' => '*']);
        (new AppServiceProvider($this->app))->boot();
        $proxy = ['REMOTE_ADDR' => '172.18.0.5'];

        // Five failures from one client lock that client out...
        for ($i = 0; $i < 5; $i++) {
            $this->withServerVariables($proxy)->withHeader('X-Forwarded-For', '203.0.113.1')
                ->postJson('/api/auth/student-login', ['access_code' => 'ZZZ999'])->assertStatus(401);
        }
        $this->withServerVariables($proxy)->withHeader('X-Forwarded-For', '203.0.113.1')
            ->postJson('/api/auth/student-login', ['access_code' => 'AAAA1111'])->assertStatus(429);

        // ...and nobody else: a different child behind the same proxy still signs in.
        $this->withServerVariables($proxy)->withHeader('X-Forwarded-For', '203.0.113.2')
            ->postJson('/api/auth/student-login', ['access_code' => 'BBBB2222'])->assertOk();

        // Share links are built for the scheme the parent will actually use.
        $url = $this->withServerVariables($proxy)->withHeader('X-Forwarded-Proto', 'https')
            ->as($this->token('t1@x.sa'))->postJson("/api/students/{$this->s1->student_id}/share-link")->assertStatus(201)->json('url');
        $this->assertStringStartsWith('https://', $url);
    }

    // ---- UC3: settings are validated, because a bad one breaks every metric ----

    public function test_settings_outside_their_range_are_refused(): void
    {
        $sys = $this->token('sys@x.sa');
        SystemSetting::whereIn('setting_key', ['d_max'])->update(['setting_value' => '3.0']);

        $this->as($sys)->putJson('/api/settings', ['settings' => ['d_max' => 0]])->assertStatus(422);
        $this->as($sys)->putJson('/api/settings', ['settings' => ['alpha' => 1.5]])->assertStatus(422);
        $this->as($sys)->putJson('/api/settings', ['settings' => ['xp_per_page' => -10]])->assertStatus(422);
        $this->as($sys)->putJson('/api/settings', ['settings' => ['not_a_setting' => 1]])->assertStatus(422);
        $this->assertSame('3.0', SystemSetting::find('d_max')->setting_value);

        $this->as($sys)->putJson('/api/settings', ['settings' => ['d_max' => 2.5, 'alpha' => 0.5]])->assertOk();
        $this->assertSame('2.5', SystemSetting::find('d_max')->setting_value);
    }

    public function test_a_zero_d_max_already_in_the_database_does_not_break_the_metrics(): void
    {
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, $this->day(1), 2, [1])->assertStatus(201);
        SystemSetting::where('setting_key', 'd_max')->update(['setting_value' => '0']);

        $this->as($this->token('t1@x.sa'))->getJson("/api/students/{$this->s1->student_id}/metrics")->assertOk();
    }

    // ---- FR21: a link is not a standing credential ----

    public function test_a_share_link_cannot_outlive_thirty_days(): void
    {
        $t = $this->token('t1@x.sa');
        $this->as($t)->postJson("/api/students/{$this->s1->student_id}/share-link", ['days' => 3650])->assertStatus(422);
        $this->as($t)->postJson("/api/students/{$this->s1->student_id}/share-link", ['days' => 7])->assertStatus(201);
    }

    // ---- FR16: the student's own report names teachers, nothing more ----

    public function test_the_student_report_carries_no_teacher_contact_details(): void
    {
        $this->t1->update(['phone' => '+966500000001', 'address' => 'Home address']);
        $report = $this->as($this->studentToken('AAAA1111'))->getJson("/api/students/{$this->s1->student_id}/report")->assertOk()->json();

        $teacher = $report['student']['teachers'][0];
        $this->assertSame($this->t1->name, $teacher['name']);
        $this->assertArrayNotHasKey('email', $teacher);
        $this->assertArrayNotHasKey('phone', $teacher);
        $this->assertArrayNotHasKey('address', $teacher);
    }

    // ---- FR13: the same session is worth the same XP whichever path wrote it ----

    public function test_the_register_awards_attendance_and_a_later_recitation_adds_only_the_pages(): void
    {
        $t = $this->token('t1@x.sa');
        $this->as($t)->postJson('/api/attendance', ['session_date' => $this->day(1),
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'P']]])->assertOk();
        $this->assertSame(5, $this->xp());

        $this->logSession($t, $this->s1->student_id, $this->day(1), 2)->assertStatus(201);
        $this->assertSame(25, $this->xp());   // 2 pages × 10 + 5, attendance not counted twice
        $this->assertSame(1, XpLedger::where('reason', 'SESSION_ATTENDED')->count());

        // Saving the same register again changes nothing.
        $this->as($t)->postJson('/api/attendance', ['session_date' => $this->day(1),
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'P']]])->assertOk();
        $this->assertSame(25, $this->xp());
    }

    public function test_marking_a_student_absent_after_a_recitation_takes_back_its_points_and_notes(): void
    {
        $t = $this->token('t1@x.sa');
        $this->logSession($t, $this->s1->student_id, $this->day(1), 3, [1, 2])->assertStatus(201);
        $this->assertSame(35, $this->xp());

        $this->as($t)->postJson('/api/attendance', ['session_date' => $this->day(1),
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'A']]])->assertOk();

        $session = RecitationSession::where('student_id', $this->s1->student_id)->first();
        $this->assertSame(0.0, $session->pages_memorized);
        $this->assertNull($session->surah_from);
        $this->assertSame(0, SessionError::where('session_id', $session->session_id)->count());
        $this->assertSame(0, $this->xp());
    }

    public function test_an_absence_recorded_through_the_form_carries_no_passage_and_no_notes(): void
    {
        $this->as($this->token('t1@x.sa'))->postJson('/api/sessions', [
            'student_id' => $this->s1->student_id, 'session_date' => $this->day(2), 'attendance_status' => 'A',
            'pages_memorized' => 2, 'surah_from' => 2, 'ayah_from' => 1, 'surah_to' => 2, 'ayah_to' => 5,
            'errors' => [['error_type_id' => 1]],
        ])->assertStatus(201);

        $session = RecitationSession::where('student_id', $this->s1->student_id)->first();
        $this->assertNull($session->surah_from);
        $this->assertSame(0, $session->errors()->count());
        $this->assertSame(0, $this->xp());
    }

    // ---- FR4/FR5: dates ----

    public function test_a_session_cannot_be_dated_in_the_future(): void
    {
        $t = $this->token('t1@x.sa');
        $tomorrow = now()->addDay()->toDateString();

        $this->logSession($t, $this->s1->student_id, $tomorrow, 1)->assertStatus(422);
        $this->as($t)->postJson('/api/attendance', ['session_date' => $tomorrow,
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'P']]])->assertStatus(422);
        $this->as($t)->getJson('/api/attendance?session_date=not-a-date')->assertStatus(422);
    }

    /** "The last eight sessions" means the eight most recent by date, not by insertion order. */
    public function test_mastery_uses_the_most_recent_sessions_by_date(): void
    {
        $t = $this->token('t1@x.sa');
        // Eight clean recent sessions...
        for ($i = 1; $i <= 8; $i++) {
            $this->logSession($t, $this->s1->student_id, $this->day($i), 1)->assertStatus(201);
        }
        // ...then an old, error-heavy session typed in late, from the paper register.
        $this->logSession($t, $this->s1->student_id, $this->day(60), 1, [1, 1, 1])->assertStatus(201);

        $m = $this->as($t)->getJson("/api/students/{$this->s1->student_id}/metrics")->assertOk()->json();
        $this->assertSame(100.0, (float) $m['mastery']);
    }

    // ---- errors surface as answers, not as 500s ----

    public function test_an_email_differing_only_in_case_is_a_validation_error(): void
    {
        $this->as($this->token('a1@x.sa'))->postJson('/api/teachers', [
            'name' => 'Clash', 'email' => 'T1@X.SA', 'password' => 'Secret2026', 'circle_id' => $this->c1->circle_id,
        ])->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_a_teacher_with_recorded_activity_is_suspended_not_deleted(): void
    {
        $this->as($this->token('t2@x.sa'))->postJson("/api/students/{$this->s2->student_id}/share-link")->assertStatus(201);

        $this->as($this->token('a1@x.sa'))->deleteJson("/api/staff/{$this->t2->user_id}")->assertStatus(409);
        $this->assertDatabaseHas('staff_user', ['user_id' => $this->t2->user_id]);
    }

    public function test_an_unknown_id_is_a_plain_404(): void
    {
        $res = $this->as($this->token('t1@x.sa'))->getJson('/api/students/99999')->assertNotFound();
        $this->assertStringNotContainsString('App\\Models', $res->json('message'));
    }

    // ---- NFR10: a refusal from the ML service reaches the screen in words ----

    public function test_the_evaluation_refusal_is_passed_on_as_a_message(): void
    {
        $this->fakeHttp(['*' => \Illuminate\Support\Facades\Http::response(['detail' => 'Dataset too small for a meaningful held-out evaluation'], 422)]);

        $this->as($this->token('sys@x.sa'))->getJson('/api/forecast-evaluation')
            ->assertStatus(422)->assertJsonPath('message', 'Dataset too small for a meaningful held-out evaluation');
    }
}
