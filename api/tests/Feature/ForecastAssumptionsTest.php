<?php

namespace Tests\Feature;

use App\Models\Prediction;
use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * FR10 assumptions — the scope and baseline pace of the supervisor's review.
 *
 * An assumption is a question put to the forecast, never a change to it: these tests pin
 * that a scenario still goes through the ML service (rule 6), falls back to a labelled
 * estimate when the service is down, reads its paces from system_setting (rule 8), and
 * writes nothing — no prediction row, no staleness flag (rule 3).
 */
class ForecastAssumptionsTest extends TestCase
{
    use RefreshDatabase;

    private const ML_OK = [
        'student_id' => 1,
        'predicted_pages_per_week' => 2.5,
        'eta_days' => 42,
        'predicted_completion_date' => '2026-05-01',
        'model_version' => 'linreg-20260401',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
        // Values unlike the code fallbacks, so a pass proves they were read from the table.
        foreach (['pace_new' => '1.5', 'pace_review' => '6', 'pace_fast' => '12', 'forecast_min_sessions' => '5'] as $k => $v) {
            SystemSetting::create(['setting_key' => $k, 'setting_value' => $v]);
        }
    }

    private function predictionUrl(int $studentId, string $query = ''): string
    {
        return "/api/students/{$studentId}/prediction".($query ? "?{$query}" : '');
    }

    public function test_a_plain_read_carries_the_assumptions_from_system_setting_and_no_scenario(): void
    {
        $body = $this->as($this->token('t1@x.sa'))->getJson($this->predictionUrl($this->s1->student_id))->assertOk()->json();

        $this->assertNull($body['scenario']);
        $this->assertEquals(['new' => 1.5, 'review' => 6, 'fast' => 12], $body['assumptions']['paces']);
        $this->assertSame(5, $body['assumptions']['min_sessions']);
        $this->assertSame(0, $body['assumptions']['sessions_count']);
        $this->assertSame(1, $body['assumptions']['current_juz']);
    }

    public function test_a_scenario_asks_the_model_with_the_scope_and_pace_and_stores_nothing(): void
    {
        $this->s1->update(['current_juz' => 3]);
        $t = $this->token('t1@x.sa');
        $this->fakeHttp(['*/forecast' => Http::response(self::ML_OK)]);
        $this->logSession($t, $this->s1->student_id, now()->toDateString(), 3)->assertStatus(201);
        $this->assertSame(1, Prediction::count());

        $scenario = $this->as($t)->getJson($this->predictionUrl($this->s1->student_id, 'scope_from=1&scope_to=30&pace=review'))
            ->assertOk()->json('scenario');

        // Juz 1–2 complete, 3 pages into Juz 3: 600 − 40 − 3 pages remain.
        Http::assertSent(fn ($req) => str_contains($req->url(), '/forecast')
            && $req['remaining_pages'] == 557 && $req['momentum'] == 6.0);
        $this->assertSame('model', $scenario['source']);
        $this->assertSame(42, $scenario['eta_days']);
        $this->assertSame(557.0, (float) $scenario['remaining_pages']);
        $this->assertSame([1, 30, 'review'], [$scenario['scope_from'], $scenario['scope_to'], $scenario['pace']]);
        // The what-if left the student's forecast history exactly as it was.
        $this->assertSame(1, Prediction::count());
    }

    public function test_with_the_service_down_the_scenario_is_a_labelled_estimate_and_the_forecast_stays_current(): void
    {
        $t = $this->token('t1@x.sa');
        $this->fakeHttp(['*/forecast' => Http::response(self::ML_OK)]);
        $this->logSession($t, $this->s1->student_id, now()->toDateString(), 0)->assertStatus(201);

        $this->fakeHttp(['*' => Http::response(['message' => 'down'], 503)]);
        $scenario = $this->as($t)->getJson($this->predictionUrl($this->s1->student_id, 'scope_from=8&scope_to=10&pace=new'))
            ->assertOk()->json('scenario');

        // Three untouched Juz at the 1.5 pages a week stored for "new memorisation".
        $this->assertSame('estimate', $scenario['source']);
        $this->assertSame(60.0, (float) $scenario['remaining_pages']);
        $this->assertSame(280, $scenario['eta_days']);
        $this->assertSame(now()->addDays(280)->toDateString(), $scenario['predicted_completion_date']);

        // A failed what-if is not a failed update: the stored forecast is not marked stale.
        $this->as($t)->getJson($this->predictionUrl($this->s1->student_id))->assertOk()->assertJsonPath('stale', false);
        $this->assertSame(1, Prediction::count());
    }

    public function test_a_range_already_memorised_needs_no_more_time(): void
    {
        $this->s1->update(['current_juz' => 5]);

        $scenario = $this->as($this->token('t1@x.sa'))
            ->getJson($this->predictionUrl($this->s1->student_id, 'scope_from=1&scope_to=3&pace=fast'))->assertOk()->json('scenario');

        $this->assertSame(0.0, (float) $scenario['remaining_pages']);
        $this->assertSame(0, $scenario['eta_days']);
    }

    /** No sessions means no recorded pace; without the model there is no date to give. */
    public function test_no_recorded_pace_and_no_service_gives_no_date_rather_than_an_invented_one(): void
    {
        $scenario = $this->as($this->token('t1@x.sa'))
            ->getJson($this->predictionUrl($this->s1->student_id, 'pace=recorded'))->assertOk()->json('scenario');

        $this->assertSame('estimate', $scenario['source']);
        $this->assertSame(0.0, (float) $scenario['pages_per_week']);
        $this->assertSame(20.0, (float) $scenario['remaining_pages']);   // the current Juz, untouched
        $this->assertNull($scenario['eta_days']);
        $this->assertNull($scenario['predicted_completion_date']);
    }

    public function test_an_invalid_scope_or_pace_is_refused(): void
    {
        $this->as($this->token('t1@x.sa'));
        foreach (['scope_from=0&scope_to=3', 'scope_from=10&scope_to=8', 'scope_from=2', 'scope_to=31&scope_from=1', 'pace=turbo'] as $q) {
            $this->getJson($this->predictionUrl($this->s1->student_id, $q))->assertStatus(422);
        }
    }

    /** FR16 — asking about a scope is a read of the forecast, with the same boundary. */
    public function test_a_student_may_ask_about_their_own_forecast_only(): void
    {
        $tok = $this->studentToken('AAAA1111');

        $this->as($tok)->getJson($this->predictionUrl($this->s1->student_id, 'scope_from=1&scope_to=30'))
            ->assertOk()->assertJsonPath('scenario.scope_to', 30);
        $this->as($tok)->getJson($this->predictionUrl($this->s2->student_id, 'scope_from=1&scope_to=30'))->assertForbidden();
        $this->as($this->token('t2@x.sa'))->getJson($this->predictionUrl($this->s1->student_id, 'pace=new'))->assertForbidden();
    }

    /** Rule 8 — the baseline paces are calibrated in UC3 like every other constant, within a range. */
    public function test_the_baseline_paces_are_settings_with_a_range(): void
    {
        $tok = $this->token('sys@x.sa');

        $this->as($tok)->putJson('/api/settings', ['settings' => ['pace_new' => 0]])->assertStatus(422);
        $this->as($tok)->putJson('/api/settings', ['settings' => ['forecast_min_sessions' => 0]])->assertStatus(422);
        $this->as($tok)->putJson('/api/settings', ['settings' => ['pace_fast' => 14, 'forecast_min_sessions' => 6]])->assertOk();

        $this->assertSame(14.0, SystemSetting::num('pace_fast', 0));
        $this->as($this->token('t1@x.sa'))->getJson($this->predictionUrl($this->s1->student_id))
            ->assertJsonPath('assumptions.paces.fast', 14)->assertJsonPath('assumptions.min_sessions', 6);
    }
}
