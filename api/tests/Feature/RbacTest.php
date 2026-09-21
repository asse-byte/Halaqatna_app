<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * I1 deliverable — the RBAC matrix of §9: every role × boundary of the Auth & RBAC Service
 * (FR1, FR2, FR3, FR16, FR18, FR19, FR20). Rate limiting lives in RateLimitTest,
 * the parent progress link in ShareLinkTest.
 */
class RbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    // ---- FR1 / FR2 ----
    public function test_staff_login_and_wrong_password(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'sys@x.sa', 'password' => 'wrong'])->assertStatus(401);
        $this->assertNotEmpty($this->token('sys@x.sa'));
    }

    public function test_student_login_and_invalid_code(): void
    {
        $this->postJson('/api/auth/student-login', ['access_code' => 'ZZZZ9999'])->assertStatus(401);
        $this->assertNotEmpty($this->studentToken('AAAA1111'));
    }

    /** §5.1 — a suspended account must fail exactly like an unknown one, or the 403 leaks that the email is real. */
    public function test_suspended_staff_cannot_login_and_is_not_distinguishable(): void
    {
        $this->t1->update(['is_active' => false]);
        $suspended = $this->postJson('/api/auth/login', ['email' => 't1@x.sa', 'password' => self::PASSWORD])->assertStatus(401);
        $unknown = $this->postJson('/api/auth/login', ['email' => 'nobody@x.sa', 'password' => self::PASSWORD])->assertStatus(401);
        $this->assertSame($unknown->json('message'), $suspended->json('message'));
    }

    public function test_suspended_student_cannot_login(): void
    {
        $this->s1->update(['is_active' => false]);
        $this->postJson('/api/auth/student-login', ['access_code' => 'AAAA1111'])->assertStatus(401);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/students')->assertStatus(401);
        $this->withHeader('Authorization', 'Bearer not.a.token')->getJson('/api/students')->assertStatus(401);
    }

    // ---- FR16 circle boundary (I1 exit test) ----
    public function test_circle_admin_cannot_read_another_circles_roster(): void
    {
        $tok = $this->token('a1@x.sa');
        $this->as($tok)->getJson("/api/circles/{$this->c2->circle_id}/roster")->assertStatus(403);
        $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/roster")->assertOk()->assertJsonCount(2, 'students');
        $this->as($tok)->getJson("/api/circles/{$this->c2->circle_id}/report")->assertStatus(403);
        $this->as($tok)->getJson("/api/circles/{$this->c2->circle_id}/leaderboard")->assertStatus(403);
        $this->as($tok)->getJson("/api/students/{$this->s3->student_id}/metrics")->assertStatus(403);
    }

    /**
     * Table 1.1 — the System Administrator administers the deployment and deals with the
     * Circle Supervisors. Circles, supervisors, settings and the audit trail are theirs;
     * rosters, students, sessions and performance data are the Supervisor's, and the two
     * remits do not nest. This test pins both halves of that boundary.
     */
    public function test_sys_admin_manages_circles_and_supervisors_but_never_circle_data(): void
    {
        $tok = $this->token('sys@x.sa');

        // Circles as administrative objects: visible, and every circle of them.
        $this->as($tok)->getJson('/api/circles')->assertOk()->assertJsonCount(2);
        $this->as($tok)->getJson("/api/circles/{$this->c2->circle_id}")->assertOk();

        // Their people are the Circle Supervisors, and only those.
        $emails = collect($this->as($tok)->getJson('/api/staff')->assertOk()->json())->pluck('email');
        $this->assertContains('a1@x.sa', $emails);
        $this->assertContains('a2@x.sa', $emails);
        $this->assertNotContains('t1@x.sa', $emails);

        // Everything inside a circle is refused.
        $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/roster")->assertStatus(403);
        $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/report")->assertStatus(403);
        $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard")->assertStatus(403);
        $this->as($tok)->getJson('/api/students')->assertStatus(403);
        $this->as($tok)->getJson("/api/students/{$this->s1->student_id}/metrics")->assertStatus(403);
        $this->as($tok)->getJson("/api/students/{$this->s1->student_id}/sessions")->assertStatus(403);
        $this->as($tok)->getJson("/api/students/{$this->s1->student_id}/report.pdf")->assertStatus(403);
        $this->as($tok)->postJson("/api/students/{$this->s1->student_id}/access-code")->assertStatus(403);
        $this->as($tok)->postJson('/api/teachers', ['name' => 'T', 'email' => 'tx@x.sa', 'password' => 'secret1', 'circle_id' => $this->c1->circle_id])->assertStatus(403);
        $this->as($tok)->postJson('/api/students', ['name' => 'N', 'circle_id' => $this->c1->circle_id])->assertStatus(403);
    }

    /**
     * FR20 — enrolling a student is the Supervisor's act, not the teacher's. A teacher who
     * also supervises the circle signs in with that role and is not blocked by this.
     */
    public function test_a_teacher_cannot_enrol_a_student(): void
    {
        $this->as($this->token('t1@x.sa'))
            ->postJson('/api/students', ['name' => 'New', 'circle_id' => $this->c1->circle_id])
            ->assertStatus(403);
        $this->as($this->token('a1@x.sa'))
            ->postJson('/api/students', ['name' => 'New', 'circle_id' => $this->c1->circle_id])
            ->assertStatus(201);
    }

    /** Staff self-service (audited) — a teacher edits their own profile but not their role or circle. */
    public function test_a_teacher_edits_their_own_profile_and_password(): void
    {
        $t = $this->token('t1@x.sa');
        $this->as($t)->patchJson('/api/me/profile', ['name' => 'Ahmad', 'phone' => '+966500000000'])->assertOk();
        $this->assertSame('Ahmad', $this->t1->fresh()->name);
        $this->assertDatabaseHas('audit_log', ['entity' => 'staff_user', 'action' => 'UPDATE', 'actor_user_id' => $this->t1->user_id]);

        // The Supervisor's roster reads the same row, so the edit is visible there at once.
        $roster = $this->as($this->token('a1@x.sa'))->getJson("/api/circles/{$this->c1->circle_id}/roster")->json('teachers');
        $this->assertContains('Ahmad', collect($roster)->pluck('name')->all());

        $this->as($t)->postJson('/api/me/password', ['current_password' => 'wrong', 'new_password' => 'NewPass2026', 'new_password_confirmation' => 'NewPass2026'])->assertStatus(422);
        $this->as($t)->postJson('/api/me/password', ['current_password' => self::PASSWORD, 'new_password' => 'NewPass2026', 'new_password_confirmation' => 'NewPass2026'])->assertOk();
        $this->flushRateLimiters();
        $this->asGuest()->postJson('/api/auth/login', ['email' => 't1@x.sa', 'password' => 'NewPass2026'])->assertOk();
    }

    public function test_circle_admin_lists_only_own_circle(): void
    {
        $this->as($this->token('a1@x.sa'))->getJson('/api/students')->assertOk()->assertJsonCount(2);
        $this->as($this->token('a1@x.sa'))->getJson('/api/circles')->assertOk()->assertJsonCount(1);
    }

    /** §9 RBAC matrix: own student 200, another teacher's student 403, circle report 403. */
    public function test_teacher_is_scoped_to_own_students(): void
    {
        $t = $this->token('t1@x.sa');
        $this->as($t)->getJson('/api/students')->assertOk()->assertJsonCount(1);
        $this->as($t)->getJson("/api/students/{$this->s1->student_id}/sessions")->assertOk();
        $this->as($t)->getJson("/api/students/{$this->s2->student_id}/sessions")->assertStatus(403); // t2's student
        $this->as($t)->getJson("/api/students/{$this->s2->student_id}/metrics")->assertStatus(403);
        $this->as($t)->getJson("/api/students/{$this->s3->student_id}/sessions")->assertStatus(403); // other circle
        $this->as($t)->getJson("/api/circles/{$this->c1->circle_id}/report")->assertStatus(403);     // admin-only
        $this->as($t)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard")->assertOk();       // aggregate: allowed
    }

    // ---- FR19 ----
    public function test_only_sys_admin_manages_circles_admins_settings_and_audit(): void
    {
        $a = $this->token('a1@x.sa'); $t = $this->token('t1@x.sa'); $s = $this->token('sys@x.sa');
        $this->as($a)->postJson('/api/circles', ['name' => 'X'])->assertStatus(403);
        $this->as($t)->postJson('/api/circles', ['name' => 'X'])->assertStatus(403);
        $this->as($s)->postJson('/api/circles', ['name' => 'X'])->assertStatus(201);
        $this->as($a)->postJson('/api/circle-admins', ['name' => 'n', 'email' => 'n@x.sa', 'password' => 'secret1', 'circle_id' => $this->c1->circle_id])->assertStatus(403);
        $this->as($a)->getJson('/api/settings')->assertStatus(403);
        $this->as($a)->getJson('/api/audit')->assertStatus(403);
        $this->as($t)->getJson('/api/audit')->assertStatus(403);
        $this->as($s)->getJson('/api/audit')->assertOk();
    }

    // ---- FR20 ----
    public function test_circle_admin_manages_teachers_and_students_only_inside_own_circle(): void
    {
        $a = $this->token('a1@x.sa');
        $this->as($a)->postJson('/api/teachers', ['name' => 'T', 'email' => 't9@x.sa', 'password' => 'secret1', 'circle_id' => $this->c2->circle_id])->assertStatus(403);
        $this->as($a)->postJson('/api/teachers', ['name' => 'T', 'email' => 't9@x.sa', 'password' => 'secret1', 'circle_id' => $this->c1->circle_id])->assertStatus(201);
        $this->as($a)->postJson('/api/students', ['name' => 'N', 'circle_id' => $this->c2->circle_id])->assertStatus(403);
        $this->as($a)->postJson('/api/students', ['name' => 'N', 'circle_id' => $this->c1->circle_id, 'teacher_ids' => [$this->t1->user_id]])->assertStatus(201);
        $this->as($a)->patchJson("/api/staff/{$this->admin2->user_id}", ['is_active' => false])->assertStatus(403);
        $this->as($a)->patchJson("/api/staff/{$this->t1->user_id}", ['is_active' => false])->assertOk();
        $this->as($a)->patchJson("/api/students/{$this->s3->student_id}", ['is_active' => false])->assertStatus(403);
        $this->as($a)->patchJson("/api/students/{$this->s1->student_id}", ['is_active' => false])->assertOk();
    }

    public function test_teacher_cannot_suspend_or_reassign_students(): void
    {
        $t = $this->token('t1@x.sa');
        $this->as($t)->patchJson("/api/students/{$this->s1->student_id}", ['is_active' => false])->assertStatus(403);
        $this->as($t)->patchJson("/api/students/{$this->s1->student_id}", ['teacher_ids' => [$this->t2->user_id]])->assertStatus(403);
        $this->as($t)->patchJson("/api/students/{$this->s1->student_id}", ['current_juz' => 3])->assertOk();
    }

    // ---- FR16 student self-scope ----
    public function test_student_is_restricted_to_own_data_and_aggregate_leaderboard(): void
    {
        $tok = $this->studentToken('AAAA1111');
        $this->as($tok)->getJson('/api/students')->assertStatus(403);
        $this->as($tok)->getJson("/api/students/{$this->s2->student_id}/metrics")->assertStatus(403);
        $this->as($tok)->getJson("/api/students/{$this->s1->student_id}/metrics")->assertOk();
        $this->as($tok)->getJson("/api/students/{$this->s1->student_id}/report.pdf")->assertStatus(403);
        $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard?criterion=consistency")->assertOk();
        $this->as($tok)->getJson("/api/circles/{$this->c2->circle_id}/leaderboard")->assertStatus(403);
        $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/roster")->assertStatus(403);
        $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/report")->assertStatus(403);
        $this->as($tok)->getJson('/api/staff')->assertStatus(403);
        $this->as($tok)->postJson('/api/sessions', ['student_id' => $this->s1->student_id, 'session_date' => '2026-01-05', 'attendance_status' => 'P', 'pages_memorized' => 1])->assertStatus(403);
        $this->as($tok)->postJson("/api/students/{$this->s1->student_id}/access-code")->assertStatus(403);
        $this->as($tok)->postJson('/api/teachers', ['name' => 'T', 'email' => 'x@x.sa', 'password' => 'secret1', 'circle_id' => $this->c1->circle_id])->assertStatus(403);
    }

    // ---- FR3 ----
    public function test_access_code_regeneration_scope(): void
    {
        $this->as($this->token('t1@x.sa'))->postJson("/api/students/{$this->s2->student_id}/access-code")->assertStatus(403);
        $old = $this->s1->access_code;
        $new = $this->as($this->token('t1@x.sa'))->postJson("/api/students/{$this->s1->student_id}/access-code")->assertOk()->json('access_code');
        $this->assertNotSame($old, $new);
        $this->postJson('/api/auth/student-login', ['access_code' => $old])->assertStatus(401);
        $this->flushRateLimiters();
        $this->postJson('/api/auth/student-login', ['access_code' => $new])->assertOk();
    }

    // ---- FR4-6, FR18 (I2 exit test) ----
    public function test_session_save_is_scoped_atomic_and_audited_even_when_ml_is_down(): void
    {
        $t = $this->token('t1@x.sa');
        $body = ['student_id' => $this->s1->student_id, 'session_date' => '2026-01-05', 'attendance_status' => 'P', 'pages_memorized' => 3,
            'errors' => [['error_type_id' => 1, 'ayah_ref' => '18:23'], ['error_type_id' => 3, 'ayah_ref' => '18:24']]];
        $this->as($t)->postJson('/api/sessions', array_merge($body, ['student_id' => $this->s2->student_id]))->assertStatus(403);
        $this->as($t)->postJson('/api/sessions', array_merge($body, ['student_id' => $this->s3->student_id]))->assertStatus(403);
        $res = $this->as($t)->postJson('/api/sessions', $body)->assertStatus(201);
        $this->assertSame(87.8, $res->json('metrics.mastery'));
        $this->assertTrue($res->json('prediction_stale'));
        $this->assertDatabaseCount('session', 1);
        $this->assertDatabaseCount('session_error', 2);
        $this->assertDatabaseHas('audit_log', ['entity' => 'session', 'action' => 'CREATE', 'actor_user_id' => $this->t1->user_id]);
        $this->assertSame(35, $res->json('awards.xp_total'));
        $this->as($t)->postJson('/api/sessions', $body)->assertStatus(409);
        $this->as($this->token('a1@x.sa'))->postJson('/api/sessions', array_merge($body, ['session_date' => '2026-01-06']))->assertStatus(403);
    }
}
