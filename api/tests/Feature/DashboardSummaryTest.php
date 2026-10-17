<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FR14 — the summary charts and the "new student" rows the supervisor's review asked for on
 * the Supervisor's and the teacher's dashboards. Everything here is computed on read from
 * the register (rule 3); these tests pin what each bar counts and whose rows it counts.
 */
class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    /** A day in an earlier week — never in the future, which the register refuses. */
    private function day(int $weeksAgo, int $dayOfWeek): string
    {
        return now()->startOfWeek()->subWeeks($weeksAgo)->addDays($dayOfWeek)->toDateString();
    }

    private function week(array $series, int $weeksAgo): array
    {
        return collect($series)->firstWhere('week', now()->startOfWeek()->subWeeks($weeksAgo)->toDateString());
    }

    public function test_weekly_attendance_covers_eight_weeks_and_leaves_an_unmarked_week_empty(): void
    {
        $t1 = $this->token('t1@x.sa');
        $this->logSession($t1, $this->s1->student_id, $this->day(3, 0), 1)->assertStatus(201);
        $this->logSession($t1, $this->s1->student_id, $this->day(3, 1), 0, [], 'A')->assertStatus(201);
        $this->logSession($t1, $this->s1->student_id, $this->day(1, 0), 1)->assertStatus(201);
        $this->logSession($this->token('t2@x.sa'), $this->s2->student_id, $this->day(3, 2), 0, [], 'E')->assertStatus(201);
        // Outside the window: never counted.
        $this->logSession($t1, $this->s1->student_id, $this->day(9, 0), 1)->assertStatus(201);

        $series = $this->as($this->token('a1@x.sa'))->getJson("/api/circles/{$this->c1->circle_id}/dashboard")
            ->assertOk()->json('weekly_attendance');

        $this->assertCount(8, $series);
        $this->assertSame(now()->startOfWeek()->toDateString(), end($series)['week']);
        // Present counts; absent and excused do not.
        $this->assertSame(['marked' => 3, 'attended' => 1, 'rate' => 33.3], array_diff_key($this->week($series, 3), ['week' => 0]));
        $this->assertSame(100, (int) $this->week($series, 1)['rate']);
        // No register that week is not "everyone absent".
        $this->assertSame(0, $this->week($series, 2)['marked']);
        $this->assertNull($this->week($series, 2)['rate']);
    }

    /** FR16 — a teacher's bars count only the students assigned to them; suspended students count for nobody. */
    public function test_weekly_attendance_is_scoped_like_the_rest_of_the_dashboard(): void
    {
        $t1 = $this->token('t1@x.sa');
        $this->logSession($t1, $this->s1->student_id, $this->day(2, 0), 1)->assertStatus(201);
        $this->logSession($this->token('t2@x.sa'), $this->s2->student_id, $this->day(2, 1), 0, [], 'A')->assertStatus(201);

        $mine = $this->as($t1)->getJson("/api/circles/{$this->c1->circle_id}/dashboard")->assertOk()->json('weekly_attendance');
        $this->assertSame(1, $this->week($mine, 2)['marked']);
        $this->assertSame(100, (int) $this->week($mine, 2)['rate']);

        $this->s2->update(['is_active' => false]);
        $circle = $this->as($this->token('a1@x.sa'))->getJson("/api/circles/{$this->c1->circle_id}/dashboard")->json('weekly_attendance');
        $this->assertSame(1, $this->week($circle, 2)['marked']);
    }

    /** FR14 — a circle whose students are all new has no average level yet; it is null, not 0. */
    public function test_the_circle_report_averages_nothing_as_null_rather_than_zero(): void
    {
        $tok = $this->token('a1@x.sa');
        $summary = $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/report")->assertOk()->json('summary');

        $this->assertNull($summary['avg_mastery']);
        $this->assertNull($summary['avg_precision']);
        $this->assertNull($summary['avg_consistency']);

        // …and an ordinary average once there is something to average.
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, $this->day(1, 0), 2)->assertStatus(201);
        $this->assertSame(100, (int) $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/report")->json('summary.avg_consistency'));
    }

    /** A student enrolled with nothing recorded does not drag the circle's averages down as a zero. */
    public function test_averages_leave_out_students_with_no_recorded_session(): void
    {
        // s1 attends and covers four pages; s2 has nothing recorded at all.
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, $this->day(1, 0), 4)->assertStatus(201);
        $tok = $this->token('a1@x.sa');

        $totals = $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/dashboard")->assertOk()->json('totals');
        $this->assertSame(100, (int) $totals['avg_attendance']);   // not 50

        $summary = $this->as($tok)->getJson("/api/circles/{$this->c1->circle_id}/report")->json('summary');
        $s1Pace = $this->as($tok)->getJson("/api/students/{$this->s1->student_id}/metrics")->json('momentum');
        $this->assertEqualsWithDelta($s1Pace, $summary['avg_momentum'], 0.1);   // not half of it
        $this->assertSame(2, $summary['students']);                             // s2 is still counted as enrolled
    }

    /** The roster can tell a student nobody has recorded yet from one whose figures are zero. */
    public function test_the_roster_counts_each_students_sessions(): void
    {
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, $this->day(1, 0), 1)->assertStatus(201);

        $students = collect($this->as($this->token('a1@x.sa'))->getJson("/api/circles/{$this->c1->circle_id}/roster")
            ->assertOk()->json('students'))->keyBy('student_id');

        $this->assertSame(1, $students[$this->s1->student_id]['sessions_count']);
        $this->assertSame(0, $students[$this->s2->student_id]['sessions_count']);
    }
}
