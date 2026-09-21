<?php

namespace Tests\Unit;

use App\Models\ErrorType;
use App\Models\RecitationSession;
use App\Models\SessionError;
use App\Services\AnalyticsEngine;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/** §3.3 worked examples and §10 calculation checklist (FR7). */
class MasteryCalculationTest extends TestCase
{
    private AnalyticsEngine $engine;
    private array $w = ['MEM_GAP' => 0.85, 'LNK_ERR' => 0.50, 'TAJ_ERR' => 0.25, 'SLF_CRT' => 0.05];

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('system_setting', function (Blueprint $t) { $t->string('setting_key')->primary(); $t->string('setting_value'); $t->string('description')->nullable(); });
        $this->engine = new AnalyticsEngine();
    }

    private function mkSession(float $pages, array $codes, string $att = 'P', string $type = 'NEW', ?string $date = null): RecitationSession
    {
        $s = new RecitationSession(['pages_memorized' => $pages, 'attendance_status' => $att, 'session_type' => $type, 'session_date' => $date ?? now()->toDateString()]);
        $s->session_id = random_int(1, 1_000_000);
        $errors = collect($codes)->map(function ($code) {
            $e = new SessionError();
            $e->setRelation('errorType', new ErrorType(['code' => $code, 'weight' => $this->w[$code]]));
            return $e;
        });
        $s->setRelation('errors', $errors);
        return $s;
    }

    public function test_worked_example_returns_87_8(): void
    {
        $this->assertSame(87.8, $this->engine->mastery(collect([$this->mkSession(3, ['MEM_GAP', 'TAJ_ERR'])])));
    }

    public function test_three_linkage_errors_over_two_pages_returns_75(): void
    {
        $this->assertSame(75.0, $this->engine->mastery(collect([$this->mkSession(2, ['LNK_ERR', 'LNK_ERR', 'LNK_ERR'])])));
    }

    public function test_mem_gap_plus_four_self_corrections_over_five_pages_returns_93(): void
    {
        $this->assertSame(93.0, $this->engine->mastery(collect([$this->mkSession(5, ['MEM_GAP', 'SLF_CRT', 'SLF_CRT', 'SLF_CRT', 'SLF_CRT'])])));
    }

    public function test_no_errors_gives_zero_load_and_full_mastery(): void
    {
        $s = $this->mkSession(2, []);
        $this->assertSame(0.0, $this->engine->errorLoad($s));
        $this->assertSame(100.0, $this->engine->mastery(collect([$s])));
    }

    public function test_zero_pages_session_is_excluded_from_mean(): void
    {
        $sessions = collect([$this->mkSession(0, ['MEM_GAP'], 'A'), $this->mkSession(3, ['MEM_GAP', 'TAJ_ERR'])]);
        $this->assertSame(87.8, $this->engine->mastery($sessions));
    }

    public function test_precision_and_consistency(): void
    {
        $sessions = collect([$this->mkSession(1, ['MEM_GAP', 'TAJ_ERR']), $this->mkSession(1, [], 'A'), $this->mkSession(1, [], 'L')]);
        // high-severity share = 0.85 / 1.10 → precision = 22.7
        $this->assertSame(22.7, $this->engine->precision($sessions));
        $this->assertSame(66.7, $this->engine->consistency($sessions));
    }

    // ---- the weekly progress curve (no new constant: pages + the §3.3 formula per week) ----

    /**
     * The level of each week is the §3.3 formula over everything recorded up to the end of
     * that week, so it accumulates rather than being recomputed from that week alone. Here
     * the first week is clean, the second adds a heavy error, and the level falls.
     */
    public function test_the_weekly_level_accumulates_and_falls_when_errors_appear(): void
    {
        $w1 = now()->startOfWeek()->subWeeks(2);
        $w2 = now()->startOfWeek()->subWeek();
        $sessions = collect([
            $this->mkSession(2, [], 'P', 'NEW', $w1->toDateString()),
            $this->mkSession(1, ['MEM_GAP', 'MEM_GAP'], 'P', 'NEW', $w2->toDateString()),
        ]);

        $trend = $this->engine->trend($sessions);

        // Three weeks: the two with sessions, plus the current one, which is empty.
        $this->assertCount(3, $trend);
        $this->assertSame($w1->toDateString(), $trend[0]['week']);
        $this->assertSame(2.0, $trend[0]['pages']);
        $this->assertSame(100.0, $trend[0]['level']);          // no errors yet

        $this->assertSame(1.0, $trend[1]['pages']);
        $this->assertSame(2, $trend[1]['errors']);
        // mean density over both sessions = (0 + 1.70) / 2 = 0.85 → 100 x (1 - 0.85/3)
        $this->assertSame(71.7, $trend[1]['level']);

        // The empty current week carries the level forward rather than dropping it to zero.
        $this->assertSame(0.0, $trend[2]['pages']);
        $this->assertSame(71.7, $trend[2]['level']);
    }

    public function test_the_direction_is_steady_until_the_change_is_real(): void
    {
        $flat = [];
        for ($i = 0; $i < 8; $i++) $flat[] = ['week' => "w{$i}", 'pages' => 1.0, 'level' => 80.0, 'errors' => 0, 'sessions' => 1];
        $this->assertSame('STEADY', $this->engine->trendDirection($flat)['direction']);

        // A one-point wobble is not a decline — a child is not told they are slipping over noise.
        $wobble = $flat;
        for ($i = 4; $i < 8; $i++) $wobble[$i]['level'] = 78.0;
        $this->assertSame('STEADY', $this->engine->trendDirection($wobble)['direction']);

        $falling = $flat;
        for ($i = 4; $i < 8; $i++) $falling[$i]['level'] = 60.0;
        $this->assertSame('DOWN', $this->engine->trendDirection($falling)['direction']);

        $rising = $flat;
        for ($i = 4; $i < 8; $i++) $rising[$i]['level'] = 95.0;
        $this->assertSame('UP', $this->engine->trendDirection($rising)['direction']);

        // Fewer than two four-week blocks cannot show a direction.
        $this->assertSame('NEW', $this->engine->trendDirection(array_slice($flat, 0, 3))['direction']);
    }

    public function test_an_empty_history_has_no_curve(): void
    {
        $this->assertSame([], $this->engine->trend(collect()));
        $this->assertSame('NEW', $this->engine->trendDirection([])['direction']);
    }
}
