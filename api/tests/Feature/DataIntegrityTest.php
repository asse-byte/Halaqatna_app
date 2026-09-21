<?php

namespace Tests\Feature;

use App\Models\Badge;
use App\Models\ErrorType;
use App\Models\RecitationSession;
use App\Models\XpLedger;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * §10 — "Data integrity", the XP invariant, and the two infrastructure guarantees that
 * the checklist lists under "Security / access control" but which live in configuration.
 */
class DataIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    private function repoPath(string $relative): string
    {
        return dirname(base_path()).'/'.$relative;
    }

    // ---- referential integrity ----

    public function test_deleting_a_session_cascades_to_its_session_error_rows(): void
    {
        $t = $this->token('t1@x.sa');
        $id = $this->logSession($t, $this->s1->student_id, '2026-02-01', 3, [1, 2, 3])->assertStatus(201)->json('session.session_id');
        $this->assertDatabaseCount('session_error', 3);

        $this->as($t)->deleteJson("/api/sessions/{$id}")->assertOk();
        $this->assertDatabaseCount('session', 0);
        $this->assertDatabaseCount('session_error', 0);
        $this->assertDatabaseHas('audit_log', ['entity' => 'session', 'action' => 'DELETE', 'entity_id' => $id]);
    }

    /** §2.3 constraint — a SYS_ADMIN staff_user must have circle_id = NULL. */
    public function test_a_sys_admin_cannot_be_bound_to_a_circle(): void
    {
        $this->assertNull($this->sys->circle_id);

        $this->expectException(\LogicException::class);
        $this->sys->update(['circle_id' => $this->c1->circle_id]);
    }

    /** §2.3 — the same invariant on insert, not only on update. */
    public function test_a_sys_admin_cannot_be_created_with_a_circle(): void
    {
        $this->expectException(\LogicException::class);
        $this->staff('sys2@x.sa', 'SYS_ADMIN', $this->c1->circle_id);
    }

    /** §2.3 — the constraint is specific to SYS_ADMIN; the scoped roles still carry a circle. */
    public function test_circle_admin_and_teacher_keep_their_circle(): void
    {
        $this->assertSame($this->c1->circle_id, $this->admin1->circle_id);
        $this->assertSame($this->c1->circle_id, $this->t1->circle_id);
    }

    /**
     * §2.5 constraint — the staff_user referenced by student_teacher must hold role TEACHER.
     * Enforced in StudentController::assignTeachers, the only write path to the junction.
     */
    public function test_a_non_teacher_cannot_be_assigned_to_a_student(): void
    {
        // The roster belongs to the Circle Supervisor (Table 1.1), so it is that role that
        // exercises this constraint — the System Administrator no longer reaches student rows.
        $admin = $this->token('a1@x.sa');

        // A Circle Supervisor is staff, and in the right circle, but is not a teacher.
        $this->as($admin)->patchJson("/api/students/{$this->s1->student_id}", [
            'teacher_ids' => [$this->admin1->user_id],
        ])->assertStatus(422);

        $this->as($admin)->patchJson("/api/students/{$this->s1->student_id}", [
            'teacher_ids' => [$this->t1->user_id],
        ])->assertOk();

        $this->assertDatabaseHas('student_teacher', [
            'student_id' => $this->s1->student_id, 'user_id' => $this->t1->user_id,
        ]);
        $this->assertDatabaseMissing('student_teacher', [
            'student_id' => $this->s1->student_id, 'user_id' => $this->admin1->user_id,
        ]);
    }

    /** §2.5 — a teacher from another circle cannot be assigned either. */
    public function test_a_teacher_from_another_circle_cannot_be_assigned(): void
    {
        $other = $this->staff('t3@x.sa', 'TEACHER', $this->c2->circle_id);

        $this->as($this->token('a1@x.sa'))
            ->patchJson("/api/students/{$this->s1->student_id}", ['teacher_ids' => [$other->user_id]])
            ->assertStatus(422);
    }

    /** RESTRICT: a weight that sessions still reference cannot be deleted out from under them. */
    public function test_deleting_an_error_type_still_in_use_is_refused(): void
    {
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, '2026-02-01', 2, [1])->assertStatus(201);
        $this->expectException(QueryException::class);
        ErrorType::where('error_type_id', 1)->delete();
    }

    /** §2.7 UNIQUE (student_id, session_date) — one session per student per day. */
    public function test_two_sessions_for_the_same_student_on_the_same_date_are_refused(): void
    {
        $t = $this->token('t1@x.sa');
        $this->logSession($t, $this->s1->student_id, '2026-02-01', 2)->assertStatus(201);
        $this->logSession($t, $this->s1->student_id, '2026-02-01', 3)->assertStatus(409);
        $this->assertDatabaseCount('session', 1);

        // The constraint is per student, not global.
        $this->logSession($this->token('t2@x.sa'), $this->s2->student_id, '2026-02-01', 2)->assertStatus(201);
        $this->assertDatabaseCount('session', 2);
    }

    /** §2.10 composite PK (student_id, badge_id) — a badge can only be earned once. */
    public function test_a_student_cannot_earn_the_same_badge_twice(): void
    {
        $badge = Badge::create(['name_ar' => 'ب', 'name_en' => 'B', 'condition_type' => 'PAGES_TOTAL', 'condition_value' => 1]);
        $this->s1->badges()->attach($badge->badge_id, ['earned_at' => now()]);

        $this->expectException(QueryException::class);
        $this->s1->badges()->attach($badge->badge_id, ['earned_at' => now()]);
    }

    /** The automatic award path (FR12) is idempotent across repeated sessions. */
    public function test_automatic_badge_award_does_not_duplicate(): void
    {
        Badge::create(['name_ar' => 'ص', 'name_en' => 'First Page', 'condition_type' => 'PAGES_TOTAL', 'condition_value' => 1]);
        $t = $this->token('t1@x.sa');
        $this->logSession($t, $this->s1->student_id, '2026-02-01', 2)->assertStatus(201);
        $this->logSession($t, $this->s1->student_id, '2026-02-02', 2)->assertStatus(201);
        $this->assertDatabaseCount('student_badge', 1);
    }

    // ---- derived values are never stored (rule 3) ----

    /** §3.8 / FR13 — the total is SUM(points) on read, never a column. */
    public function test_total_xp_always_equals_the_sum_of_the_ledger(): void
    {
        $t = $this->token('t1@x.sa');
        $this->logSession($t, $this->s1->student_id, '2026-02-01', 3)->assertStatus(201);        // 3×10 + 5 = 35
        $this->logSession($t, $this->s1->student_id, '2026-02-02', 1.5)->assertStatus(201);      // 15 + 5 = 20
        $this->logSession($t, $this->s1->student_id, '2026-02-03', 0, [], 'A')->assertStatus(201); // absent: 0

        $ledgerSum = (int) XpLedger::where('student_id', $this->s1->student_id)->sum('points');
        $reported = $this->as($t)->getJson("/api/students/{$this->s1->student_id}/xp")->assertOk()->json('total');
        $metrics = $this->as($t)->getJson("/api/students/{$this->s1->student_id}/metrics")->assertOk()->json('xp_total');

        $this->assertSame(55, $ledgerSum);
        $this->assertSame($ledgerSum, $reported);
        $this->assertSame($ledgerSum, $metrics);
        // No stored total anywhere: the column simply does not exist.
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('student', 'xp_total'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('student', 'mastery'));
    }

    /** An absent session records attendance but no pages and no page XP. */
    public function test_absent_session_records_zero_pages(): void
    {
        $t = $this->token('t1@x.sa');
        $this->logSession($t, $this->s1->student_id, '2026-02-01', 4, [], 'A')->assertStatus(201);
        $this->assertSame(0.0, (float) RecitationSession::first()->pages_memorized);
        $this->assertSame(0, (int) XpLedger::where('student_id', $this->s1->student_id)->sum('points'));
    }

    // ---- FR11: four independent rankings, never one combined ranking ----

    public function test_a_low_momentum_but_never_absent_student_ranks_top_on_consistency(): void
    {
        $t1 = $this->token('t1@x.sa');
        $t2 = $this->token('t2@x.sa');
        // Recent dates: momentum is an EWMA of pages per week, so old sessions decay to zero.
        $days = collect(range(1, 4))->map(fn ($i) => now()->subDays($i)->toDateString())->all();
        // s1: small pages, perfect attendance. s2: big pages, misses half the sessions.
        foreach ($days as $d) {
            $this->logSession($t1, $this->s1->student_id, $d, 0.5)->assertStatus(201);
        }
        foreach ([[$days[0], 5, 'P'], [$days[1], 0, 'A'], [$days[2], 5, 'P'], [$days[3], 0, 'A']] as [$d, $p, $a]) {
            $this->logSession($t2, $this->s2->student_id, $d, $p, [], $a)->assertStatus(201);
        }

        $admin = $this->token('a1@x.sa');
        $byConsistency = $this->as($admin)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard?criterion=consistency")->assertOk()->json('rows');
        $byMomentum = $this->as($admin)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard?criterion=momentum")->assertOk()->json('rows');

        $this->assertSame($this->s1->student_id, $byConsistency[0]['student_id']);
        $this->assertSame($this->s2->student_id, $byMomentum[0]['student_id']);
        // Four separate rankings, never combined into one score.
        $this->as($admin)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard?criterion=precision")->assertOk();
        $this->as($admin)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard?criterion=review_depth")->assertOk();
        $this->as($admin)->getJson("/api/circles/{$this->c1->circle_id}/leaderboard?criterion=overall")->assertStatus(422);
    }

    // ---- infrastructure guarantees the checklist calls for ----

    /** Rule 4 — the DB user must have no UPDATE or DELETE grant on audit_log or xp_ledger. */
    public function test_append_only_tables_have_no_update_or_delete_grant(): void
    {
        $grants = file_get_contents($this->repoPath('scripts/db_grants.sql'));
        foreach (['audit_log', 'xp_ledger'] as $table) {
            $line = collect(explode("\n", $grants))->first(fn ($l) => str_contains($l, 'halaqtna.'.$table.' '));
            $this->assertNotNull($line, "no grant line for {$table}");
            $this->assertStringContainsString('GRANT SELECT, INSERT ON', $line);
            $this->assertStringNotContainsString('UPDATE', $line);
            $this->assertStringNotContainsString('DELETE', $line);
        }
    }

    /** Rule 6 — the ML port is never published outside the host; only nginx publishes ports. */
    public function test_only_nginx_publishes_ports(): void
    {
        $compose = file_get_contents($this->repoPath('docker/docker-compose.yml'));
        // Everything from the `api:` service onwards must declare no published ports.
        $afterNginx = substr($compose, strpos($compose, "\n  api:"));
        $this->assertStringNotContainsString("\n    ports:", $afterNginx);
        $this->assertStringContainsString("\n    ports:", substr($compose, 0, strpos($compose, "\n  api:")));
    }
}
