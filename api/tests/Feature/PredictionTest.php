<?php

namespace Tests\Feature;

use App\Models\Prediction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * FR10 / UC13 / UC16 — the completion forecast.
 *
 * The ML service is a separate container reached by internal HTTP (rule 6). These tests
 * fake that HTTP boundary so both sides of it are covered: the success path (a new
 * `prediction` row per §2.9) and the UC13 fallback when the container is unreachable.
 */
class PredictionTest extends TestCase
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
    }

    /** The ML container answers: a forecast is stored and returned as fresh. */
    public function test_a_reachable_ml_service_stores_a_prediction(): void
    {
        $this->fakeHttp(['*/forecast' => Http::response(self::ML_OK)]);

        $body = $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, '2026-03-01', 3)
            ->assertStatus(201)->json();

        $this->assertFalse($body['prediction_stale']);
        $this->assertSame('linreg-20260401', $body['prediction']['model_version']);
        $this->assertSame(42, $body['prediction']['eta_days']);
        $this->assertDatabaseHas('prediction', [
            'student_id' => $this->s1->student_id, 'eta_days' => 42, 'model_version' => 'linreg-20260401',
        ]);
    }

    /** §2.9 — many rows per student; a new forecast never overwrites the previous one. */
    public function test_each_forecast_is_a_new_row_never_an_update(): void
    {
        $this->fakeHttp(['*/forecast' => Http::response(self::ML_OK)]);
        $t = $this->token('t1@x.sa');

        $this->logSession($t, $this->s1->student_id, '2026-03-01', 3)->assertStatus(201);
        $this->fakeHttp(['*/forecast' => Http::response(array_merge(self::ML_OK, [
            'eta_days' => 30, 'model_version' => 'linreg-20260402',
        ]))]);
        $this->logSession($t, $this->s1->student_id, '2026-03-03', 3)->assertStatus(201);

        $rows = Prediction::where('student_id', $this->s1->student_id)->orderBy('prediction_id')->get();
        $this->assertCount(2, $rows);
        $this->assertSame(42, (int) $rows[0]->eta_days);   // the first row is untouched
        $this->assertSame(30, (int) $rows[1]->eta_days);
    }

    /** §3.9 — the API sends exactly the three features the model is specified to take. */
    public function test_the_three_specified_features_are_sent_to_the_service(): void
    {
        $this->fakeHttp(['*/forecast' => Http::response(self::ML_OK)]);

        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, '2026-03-01', 3, [1])->assertStatus(201);

        Http::assertSent(function ($request) {
            $d = $request->data();
            foreach (['momentum', 'error_density', 'attendance_rate'] as $feature) {
                $this->assertArrayHasKey($feature, $d);
                $this->assertIsNumeric($d[$feature]);
            }
            return str_contains($request->url(), '/forecast');
        });
    }

    /** UC13 alternative flow — the service is down: show the last stored forecast with its timestamp. */
    public function test_ml_down_falls_back_to_the_last_stored_prediction_with_its_timestamp(): void
    {
        $t = $this->token('t1@x.sa');
        $this->fakeHttp(['*/forecast' => Http::response(self::ML_OK)]);
        $this->logSession($t, $this->s1->student_id, '2026-03-01', 3)->assertStatus(201);

        // The container goes away.
        $this->fakeHttp(['*' => Http::response(['message' => 'down'], 503)]);

        $body = $this->as($t)->getJson("/api/students/{$this->s1->student_id}/prediction?refresh=1")
            ->assertOk()->json();

        $this->assertTrue($body['stale']);
        $this->assertFalse($body['ml_available']);
        $this->assertNotNull($body['generated_at']);
        $this->assertSame('linreg-20260401', $body['prediction']['model_version']);

        // No second row was invented while the service was unreachable.
        $this->assertSame(1, Prediction::where('student_id', $this->s1->student_id)->count());
    }

    /** A student who has never had a forecast gets an explicit null, not an error. */
    public function test_no_prediction_yet_is_reported_as_null_and_stale(): void
    {
        $this->fakeHttp(['*' => Http::response(['message' => 'down'], 503)]);

        $body = $this->as($this->token('t1@x.sa'))
            ->getJson("/api/students/{$this->s1->student_id}/prediction")
            ->assertOk()->json();

        $this->assertNull($body['prediction']);
        $this->assertTrue($body['stale']);
    }

    /** An error response must not be written as if it were a forecast. */
    public function test_an_error_response_stores_nothing(): void
    {
        $this->fakeHttp(['*/forecast' => Http::response(['detail' => 'not enough rows'], 422)]);

        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, '2026-03-01', 3)
            ->assertStatus(201)
            ->assertJsonPath('prediction_stale', true);

        $this->assertDatabaseCount('prediction', 0);
    }

    /** FR16 — a student may read their own forecast (UC13 is shared) but not another's. */
    public function test_students_read_only_their_own_prediction(): void
    {
        $this->fakeHttp(['*' => Http::response([], 503)]);
        $s1Token = $this->studentToken('AAAA1111');

        $this->as($s1Token)->getJson("/api/students/{$this->s1->student_id}/prediction")->assertOk();
        $this->as($s1Token)->getJson("/api/students/{$this->s2->student_id}/prediction")->assertForbidden();
    }
}
