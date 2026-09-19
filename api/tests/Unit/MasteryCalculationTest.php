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

    private function mkSession(float $pages, array $codes, string $att = 'P', string $type = 'NEW'): RecitationSession
    {
        $s = new RecitationSession(['pages_memorized' => $pages, 'attendance_status' => $att, 'session_type' => $type, 'session_date' => now()->toDateString()]);
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
}
