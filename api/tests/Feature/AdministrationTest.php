<?php

namespace Tests\Feature;

use App\Models\Circle;
use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FR19 (System Administrator: circles, circle administrators, settings), FR20 (Circle
 * Administrator: teachers and students), FR3 (access codes) and the student-facing reads
 * of UC19–UC23.
 */
class AdministrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    // ---- FR19: circles ----

    public function test_sys_admin_creates_updates_and_reads_a_circle(): void
    {
        $sys = $this->token('sys@x.sa');

        $id = $this->as($sys)->postJson('/api/circles', [
            'name' => 'حلقة النور', 'location' => 'Jeddah', 'schedule_time' => '16:30',
        ])->assertStatus(201)->json('circle_id');

        $this->assertDatabaseHas('audit_log', ['entity' => 'circle', 'action' => 'CREATE', 'entity_id' => $id]);

        $this->as($sys)->putJson("/api/circles/{$id}", ['name' => 'حلقة النور المسائية'])->assertOk();
        $this->assertSame('حلقة النور المسائية', Circle::find($id)->name);
        $this->assertDatabaseHas('audit_log', ['entity' => 'circle', 'action' => 'UPDATE', 'entity_id' => $id]);

        $this->as($sys)->getJson("/api/circles/{$id}")->assertOk()->assertJsonPath('circle_id', $id);
    }

    public function test_circle_creation_validates_its_input(): void
    {
        $sys = $this->token('sys@x.sa');
        $this->as($sys)->postJson('/api/circles', [])->assertStatus(422);
        $this->as($sys)->postJson('/api/circles', ['name' => 'X', 'schedule_time' => 'half past four'])->assertStatus(422);
    }

    /** FR19 is System Administrator only — a Circle Administrator cannot create circles. */
    public function test_circle_admin_cannot_create_or_update_a_circle(): void
    {
        $a1 = $this->token('a1@x.sa');
        $this->as($a1)->postJson('/api/circles', ['name' => 'Nope'])->assertForbidden();
        $this->as($a1)->putJson("/api/circles/{$this->c1->circle_id}", ['name' => 'Nope'])->assertForbidden();
    }

    public function test_circle_admin_cannot_read_another_circle_directly(): void
    {
        $this->as($this->token('a1@x.sa'))->getJson("/api/circles/{$this->c2->circle_id}")->assertForbidden();
    }

    // ---- FR19: circle administrators ----

    public function test_sys_admin_creates_a_circle_administrator_who_can_then_sign_in(): void
    {
        $this->as($this->token('sys@x.sa'))->postJson('/api/circle-admins', [
            'name' => 'Munthir Al-Farsi', 'email' => 'Munthir@Halaqtna.SA', 'password' => 'secret1', 'circle_id' => $this->c2->circle_id,
        ])->assertStatus(201)->assertJsonPath('role', 'CIRCLE_ADMIN');

        // The email is normalised to lower case, so sign-in is case-insensitive.
        $this->assertDatabaseHas('staff_user', ['email' => 'munthir@halaqtna.sa']);
        $this->postJson('/api/auth/login', ['email' => 'munthir@halaqtna.sa', 'password' => 'secret1'])->assertOk();
    }

    public function test_duplicate_email_is_refused(): void
    {
        $this->as($this->token('sys@x.sa'))->postJson('/api/circle-admins', [
            'name' => 'Clash', 'email' => 't1@x.sa', 'password' => 'secret1', 'circle_id' => $this->c1->circle_id,
        ])->assertStatus(422);
    }

    // ---- FR19: settings — the provisional constants (rule 8) ----

    public function test_sys_admin_reads_and_calibrates_the_provisional_constants(): void
    {
        $sys = $this->token('sys@x.sa');

        $this->as($sys)->getJson('/api/settings')->assertOk()->assertJsonFragment(['setting_key' => 'd_max']);

        $this->as($sys)->putJson('/api/settings', ['settings' => ['d_max' => 2.5, 'alpha' => 0.5]])->assertOk();
        $this->assertSame(2.5, SystemSetting::num('d_max', 0));
        $this->assertSame(0.5, SystemSetting::num('alpha', 0));
        $this->assertDatabaseHas('audit_log', ['entity' => 'system_setting', 'action' => 'UPDATE']);
    }

    /** Calibration must actually reach the Analytics Engine, or the constants are decorative. */
    public function test_changing_d_max_changes_the_computed_mastery(): void
    {
        // 3 pages, MEM_GAP + TAJ_ERR -> d = 1.10/3. With d_max 3.0 this is the §3.3 worked example.
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, '2026-02-01', 3, [1, 3])->assertStatus(201);

        $before = $this->as($this->token('t1@x.sa'))
            ->getJson("/api/students/{$this->s1->student_id}/metrics")->json('mastery');
        $this->assertEqualsWithDelta(87.8, $before, 0.05);

        $this->as($this->token('sys@x.sa'))->putJson('/api/settings', ['settings' => ['d_max' => 1.5]])->assertOk();

        $after = $this->as($this->token('t1@x.sa'))
            ->getJson("/api/students/{$this->s1->student_id}/metrics")->json('mastery');
        $this->assertEqualsWithDelta(75.6, $after, 0.05);   // 100 * (1 - (1.10/3)/1.5)
    }

    public function test_settings_reject_a_non_numeric_value(): void
    {
        $this->as($this->token('sys@x.sa'))
            ->putJson('/api/settings', ['settings' => ['d_max' => 'three']])->assertStatus(422);
    }

    // ---- FR20: teachers and students ----

    public function test_circle_admin_creates_a_teacher_inside_own_circle(): void
    {
        $body = $this->as($this->token('a1@x.sa'))->postJson('/api/teachers', [
            'name' => 'New Teacher', 'email' => 'new.teacher@x.sa', 'password' => 'secret1', 'circle_id' => $this->c1->circle_id,
        ])->assertStatus(201)->json();

        $this->assertSame('TEACHER', $body['role']);
        $this->assertSame($this->c1->circle_id, $body['circle_id']);
    }

    public function test_staff_listing_is_scoped_to_the_callers_circle(): void
    {
        $emails = collect($this->as($this->token('a1@x.sa'))->getJson('/api/staff')->assertOk()->json())->pluck('email');
        $this->assertContains('t1@x.sa', $emails);
        $this->assertNotContains('a2@x.sa', $emails);   // the other circle's admin

        // The System Administrator sees everyone.
        $all = collect($this->as($this->token('sys@x.sa'))->getJson('/api/staff')->json())->pluck('email');
        $this->assertContains('a2@x.sa', $all);
    }

    /** FR20 — suspension is what "suspend a teacher" means: the account can no longer sign in. */
    public function test_suspending_a_teacher_blocks_sign_in(): void
    {
        $this->postJson('/api/auth/login', ['email' => 't1@x.sa', 'password' => self::PASSWORD])->assertOk();

        $this->as($this->token('a1@x.sa'))
            ->patchJson("/api/staff/{$this->t1->user_id}", ['is_active' => false])->assertOk();

        $this->flushRateLimiters();
        $this->asGuest()->postJson('/api/auth/login', ['email' => 't1@x.sa', 'password' => self::PASSWORD])
            ->assertStatus(401);
    }

    public function test_a_system_administrator_cannot_be_edited_through_the_staff_endpoint(): void
    {
        $this->as($this->token('sys@x.sa'))
            ->patchJson("/api/staff/{$this->sys->user_id}", ['is_active' => false])->assertForbidden();
    }

    public function test_creating_a_student_issues_a_unique_eight_character_access_code(): void
    {
        $body = $this->as($this->token('a1@x.sa'))->postJson('/api/students', [
            'name' => 'New Student', 'circle_id' => $this->c1->circle_id, 'teacher_ids' => [$this->t1->user_id],
        ])->assertStatus(201)->json();

        $this->assertSame(8, strlen($body['access_code']));
        // FR2/FR3 — the code is the student's sole credential and must work immediately.
        $this->postJson('/api/auth/student-login', ['access_code' => $body['access_code']])->assertOk();
    }

    /** FR3 — regenerating a code revokes the old one. */
    public function test_regenerating_an_access_code_invalidates_the_previous_code(): void
    {
        $new = $this->as($this->token('t1@x.sa'))
            ->postJson("/api/students/{$this->s1->student_id}/access-code")
            ->assertOk()->json('access_code');

        $this->assertNotSame('AAAA1111', $new);
        $this->postJson('/api/auth/student-login', ['access_code' => $new])->assertOk();

        $this->flushRateLimiters();
        $this->postJson('/api/auth/student-login', ['access_code' => 'AAAA1111'])->assertStatus(401);
    }

    public function test_student_listing_is_scoped_and_a_teacher_sees_only_their_own(): void
    {
        $mine = collect($this->as($this->token('t1@x.sa'))->getJson('/api/students')->assertOk()->json())->pluck('student_id');
        $this->assertContains($this->s1->student_id, $mine);
        $this->assertNotContains($this->s2->student_id, $mine);   // taught by t2
        $this->assertNotContains($this->s3->student_id, $mine);   // other circle
    }

    // ---- UC19–UC23: the student's own reads ----

    public function test_a_student_reads_their_dashboard_badges_xp_journey_and_challenges(): void
    {
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, '2026-02-01', 3, [1])->assertStatus(201);
        $me = $this->studentToken('AAAA1111');
        $id = $this->s1->student_id;

        $this->as($me)->getJson("/api/students/{$id}/metrics")->assertOk()->assertJsonStructure(['mastery', 'momentum', 'precision', 'consistency', 'review_depth']);
        $this->as($me)->getJson("/api/students/{$id}/sessions")->assertOk()->assertJsonCount(1);
        $this->as($me)->getJson("/api/students/{$id}/badges")->assertOk()->assertJsonStructure(['earned', 'all']);
        $this->as($me)->getJson("/api/students/{$id}/challenges")->assertOk()->assertJsonStructure(['mine', 'available']);

        // FR13 — the total is the ledger sum.
        $xp = $this->as($me)->getJson("/api/students/{$id}/xp")->assertOk()->json();
        $this->assertSame((int) collect($xp['ledger'])->sum('points'), $xp['total']);

        // UC20 — the 30-Juz journey map.
        $journey = $this->as($me)->getJson("/api/students/{$id}/journey")->assertOk()->json();
        $this->assertCount(30, $journey['tiles']);
        $this->assertSame('IN_PROGRESS', collect($journey['tiles'])->firstWhere('juz', $journey['current_juz'])['status']);
    }

    /** UC23 — joining a challenge, and the guard against joining twice. */
    public function test_a_student_joins_a_challenge_once(): void
    {
        $c = \App\Models\Challenge::create([
            'title_ar' => 'تحدٍ', 'title_en' => 'Ten pages', 'target_value' => 10, 'duration_days' => 14, 'xp_reward' => 150,
        ]);
        $me = $this->studentToken('AAAA1111');
        $id = $this->s1->student_id;

        $this->as($me)->postJson("/api/students/{$id}/challenges/{$c->challenge_id}/join")->assertStatus(201);
        $this->assertDatabaseHas('student_challenge', ['student_id' => $id, 'challenge_id' => $c->challenge_id, 'status' => 'ACTIVE']);

        $this->as($me)->postJson("/api/students/{$id}/challenges/{$c->challenge_id}/join")->assertStatus(409);
    }

    /** FR16 — a student cannot join a challenge on someone else's behalf. */
    public function test_a_student_cannot_join_a_challenge_for_another_student(): void
    {
        $c = \App\Models\Challenge::create([
            'title_ar' => 'تحدٍ', 'title_en' => 'Ten pages', 'target_value' => 10, 'duration_days' => 14, 'xp_reward' => 150,
        ]);

        $this->as($this->studentToken('AAAA1111'))
            ->postJson("/api/students/{$this->s2->student_id}/challenges/{$c->challenge_id}/join")
            ->assertForbidden();
    }

    // ---- reference data and health ----

    public function test_error_types_expose_the_four_weighted_codes(): void
    {
        $rows = $this->as($this->token('t1@x.sa'))->getJson('/api/error-types')->assertOk()->json();

        $this->assertSame(['MEM_GAP', 'LNK_ERR', 'TAJ_ERR', 'SLF_CRT'], collect($rows)->pluck('code')->all());
        // §2.6 — the weight lives here once (3NF); session_error has no weight column.
        $this->assertEqualsWithDelta(0.85, (float) collect($rows)->firstWhere('code', 'MEM_GAP')['weight'], 0.001);
    }

    public function test_health_endpoint_is_public(): void
    {
        $this->asGuest()->getJson('/api/health')->assertOk()->assertJsonPath('service', 'halaqtna-api');
    }

    /** The root route identifies the service rather than serving a framework landing page. */
    public function test_root_identifies_the_service(): void
    {
        $this->asGuest()->getJson('/')->assertOk()->assertJsonPath('service', 'halaqtna-api');
    }
}
