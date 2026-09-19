<?php

namespace App\Services;

use App\Models\Circle;
use App\Models\Student;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

/** Report Service — FR14, FR15. The ONLY component that writes to file storage. */
class ReportService
{
    public function __construct(private AnalyticsEngine $analytics, private GamificationEngine $gamification, private MlClient $ml) {}

    public function studentReport(Student $student): array
    {
        $sessions = $student->sessions()->with('errors.errorType', 'teacher')->orderByDesc('session_date')->get();
        return [
            'student' => $student->load('circle', 'teachers'),
            'metrics' => $this->analytics->metrics($student),
            'xp_total' => $this->gamification->totalXp($student->student_id),
            'badges' => $student->badges()->get(),
            'prediction' => $this->ml->latest($student),
            'sessions' => $sessions->map(fn ($s) => [
                'session_id' => $s->session_id, 'session_date' => $s->session_date, 'teacher' => $s->teacher->name,
                'range' => "{$s->surah_from}:{$s->ayah_from} – {$s->surah_to}:{$s->ayah_to}",
                'pages_memorized' => $s->pages_memorized, 'attendance_status' => $s->attendance_status, 'session_type' => $s->session_type,
                'error_load' => $this->analytics->errorLoad($s),
                'errors' => $s->errors->map(fn ($e) => ['code' => $e->errorType->code, 'label_en' => $e->errorType->label_en, 'label_ar' => $e->errorType->label_ar, 'weight' => $e->errorType->weight, 'ayah_ref' => $e->ayah_ref])->values(),
            ])->values(),
        ];
    }

    /** FR14 — term report per circle (aggregate + per student rows). */
    public function circleReport(Circle $circle): array
    {
        $students = $circle->students()->get()->map(function ($s) {
            $m = $this->analytics->metrics($s);
            return ['student_id' => $s->student_id, 'name' => $s->name, 'current_juz' => $s->current_juz, 'is_active' => $s->is_active,
                'mastery' => $m['mastery'], 'momentum' => $m['momentum'], 'precision' => $m['precision'], 'consistency' => $m['consistency'],
                'review_depth' => $m['review_depth'], 'total_pages' => $m['total_pages'], 'sessions_count' => $m['sessions_count'],
                'xp_total' => $this->gamification->totalXp($s->student_id)];
        })->values();
        $avg = fn ($k) => round((float) $students->pluck($k)->filter(fn ($v) => $v !== null)->avg(), 1);
        return [
            'circle' => $circle->load('staff.role'),
            'generated_at' => now()->toDateTimeString(),
            'summary' => ['students' => $students->count(), 'total_pages' => round((float) $students->sum('total_pages'), 2), 'sessions' => (int) $students->sum('sessions_count'),
                'avg_mastery' => $avg('mastery'), 'avg_momentum' => $avg('momentum'), 'avg_precision' => $avg('precision'), 'avg_consistency' => $avg('consistency')],
            'students' => $students,
        ];
    }

    /** FR15 — PDF export; file is persisted under storage (only this service writes files). */
    public function studentPdf(Student $student, string $locale = 'en'): string
    {
        $data = $this->studentReport($student) + ['locale' => $locale];
        $pdf = Pdf::loadView('reports.student', $data)->setPaper('a4');
        $path = "reports/student_{$student->student_id}_".now()->format('Ymd_His').'.pdf';
        Storage::put($path, $pdf->output());
        return Storage::path($path);
    }

    public function circlePdf(Circle $circle, string $locale = 'en'): string
    {
        $data = $this->circleReport($circle) + ['locale' => $locale];
        $pdf = Pdf::loadView('reports.circle', $data)->setPaper('a4', 'landscape');
        $path = "reports/circle_{$circle->circle_id}_".now()->format('Ymd_His').'.pdf';
        Storage::put($path, $pdf->output());
        return Storage::path($path);
    }
}
