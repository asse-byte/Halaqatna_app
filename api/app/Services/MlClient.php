<?php

namespace App\Services;

use App\Models\Prediction;
use App\Models\Student;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** Thin client for the Python ML Prediction Service (FR10) — internal HTTP only. */
class MlClient
{
    private function url(string $path): string
    {
        return config('halaqtna.ml.url').$path;
    }

    /** Returns the freshly stored prediction, or null when the service is unavailable (UC13 fallback). */
    public function forecast(Student $student, array $metrics): ?Prediction
    {
        try {
            $resp = Http::timeout((int) config('halaqtna.ml.timeout', 3))
                ->post($this->url('/forecast'), [
                    'student_id' => $student->student_id,
                    'momentum' => $metrics['momentum'] ?? 0,
                    'error_density' => $metrics['error_density'] ?? 0,
                    'attendance_rate' => $metrics['attendance_rate'] ?? 0,
                    'remaining_pages' => max(0, AnalyticsEngine::PAGES_PER_JUZ - ($metrics['pages_in_current_juz'] ?? 0)),
                ]);
            if (!$resp->successful()) return null;
            $d = $resp->json();
            // New row every time — old predictions are never overwritten.
            return Prediction::create([
                'student_id' => $student->student_id,
                'predicted_completion_date' => $d['predicted_completion_date'],
                'eta_days' => max(0, (int) $d['eta_days']),
                'model_version' => $d['model_version'],
                'generated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('ML service unavailable: '.$e->getMessage());
            return null;
        }
    }

    public function latest(Student $student): ?Prediction
    {
        return Prediction::where('student_id', $student->student_id)->orderByDesc('prediction_id')->first();
    }

    /**
     * NFR10 — the held-out evaluation. Returns [status, body] ready to pass back to the client.
     *
     * FastAPI reports a refusal as {"detail": "..."}; it is re-keyed as `message`, which is
     * where every client of this API looks for an error. Without that, "the dataset is too
     * small for a meaningful evaluation" — the honest answer §9 asks for — reached the
     * screen as a bare "Something went wrong".
     */
    public function evaluate(float $testShare): array
    {
        try {
            $resp = Http::timeout((int) config('halaqtna.ml.evaluation_timeout', 60))
                ->post($this->url('/evaluate'), ['test_share' => $testShare]);
        } catch (\Throwable $e) {
            Log::warning('ML service unavailable: '.$e->getMessage());

            return [503, ['message' => 'The forecasting service is not reachable right now.']];
        }
        $body = $resp->json();
        if ($resp->successful() && is_array($body)) {
            return [200, $body];
        }
        $detail = is_array($body) ? ($body['detail'] ?? $body['message'] ?? null) : null;

        return [$resp->status() >= 500 ? 502 : $resp->status(), ['message' => is_string($detail) ? $detail : 'The forecasting service could not run the evaluation.']];
    }
}
