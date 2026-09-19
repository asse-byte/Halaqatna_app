<?php

namespace App\Services;

use App\Models\Prediction;
use App\Models\Student;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** Thin client for the Python ML Prediction Service (FR10) — internal HTTP only. */
class MlClient
{
    /** Returns the freshly stored prediction, or null when the service is unavailable (UC13 fallback). */
    public function forecast(Student $student, array $metrics): ?Prediction
    {
        try {
            $resp = Http::timeout((int) env('ML_TIMEOUT_SECONDS', 3))
                ->post(rtrim(env('ML_SERVICE_URL'), '/').'/forecast', [
                    'student_id' => $student->student_id,
                    'momentum' => $metrics['momentum'] ?? 0,
                    'error_density' => $metrics['error_density'] ?? 0,
                    'attendance_rate' => $metrics['attendance_rate'] ?? 0,
                    'remaining_pages' => max(0, 20 - ($metrics['pages_in_current_juz'] ?? 0)),
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
}
