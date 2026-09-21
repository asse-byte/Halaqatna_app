<?php

namespace App\Services;

use App\Models\Circle;
use App\Models\Student;
use App\Support\Surah;
use Illuminate\Support\Facades\Storage;

/** Report Service — FR14, FR15. The ONLY component that writes to file storage. */
class ReportService
{
    public function __construct(
        private AnalyticsEngine $analytics,
        private GamificationEngine $gamification,
        private MlClient $ml,
        private PdfRenderer $pdf,
    ) {}

    /**
     * Mastery as a word rather than a number, for the places a reader needs a verdict and
     * not a score. Shares its thresholds with the parent card so the two never disagree.
     */
    public static function band(?float $mastery): string
    {
        return \App\Http\Controllers\ShareController::masteryBand($mastery);
    }

    public function studentReport(Student $student, string $locale = 'ar'): array
    {
        $sessions = $student->sessions()->with('errors.errorType', 'teacher')->orderByDesc('session_date')->get();
        $metrics = $this->analytics->metrics($student);

        return [
            'student' => $student->load('circle', 'teachers'),
            'metrics' => $metrics,
            'band' => self::band($metrics['mastery']),
            'xp_total' => $this->gamification->totalXp($student->student_id),
            'badges' => $student->badges()->get(),
            'prediction' => $this->ml->latest($student),
            'sessions' => $sessions->map(fn ($s) => [
                'session_id' => $s->session_id, 'session_date' => $s->session_date, 'teacher' => $s->teacher?->name,
                // The range reads as "البقرة 1 – 5", never as the raw "2:1 – 2:5" a reader has to decode.
                'range' => Surah::range($s->surah_from, $s->ayah_from, $s->surah_to, $s->ayah_to, $locale),
                'pages_memorized' => $s->pages_memorized, 'attendance_status' => $s->attendance_status, 'session_type' => $s->session_type,
                'error_count' => $s->errors->count(),
                'accuracy' => $this->analytics->sessionAccuracy($s),
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
                'mastery' => $m['mastery'], 'band' => self::band($m['mastery']), 'momentum' => $m['momentum'],
                'precision' => $m['precision'], 'consistency' => $m['consistency'],
                'review_depth' => $m['review_depth'], 'total_pages' => $m['total_pages'], 'sessions_count' => $m['sessions_count'],
                'attendance_rate' => $m['attendance_rate'], 'error_count' => $m['error_count'],
                'trend' => $m['trend_summary']['direction'],
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

    /**
     * The at-a-glance view behind the Supervisor's and the teacher's dashboards.
     *
     * Beyond the circle totals it names the students who need attention now — the ones whose
     * curve is falling, and the ones who have missed the most recent sessions. That is what
     * P1 of the report asked for: a trend a teacher can act on, not a pile of rows to read.
     * A teacher passing their own id sees only the students assigned to them (FR16).
     */
    public function dashboard(Circle $circle, ?int $teacherId = null): array
    {
        $query = $circle->students()->with('teachers:user_id,name');
        if ($teacherId !== null) {
            $query->whereHas('teachers', fn ($q) => $q->where('staff_user.user_id', $teacherId));
        }
        $students = $query->get();

        $rows = $students->map(function ($s) {
            $m = $this->analytics->metrics($s);
            $last = $s->sessions()->orderByDesc('session_date')->first();
            return [
                'student_id' => $s->student_id, 'name' => $s->name, 'current_juz' => $s->current_juz,
                'is_active' => (bool) $s->is_active,
                'mastery' => $m['mastery'], 'band' => self::band($m['mastery']),
                'momentum' => $m['momentum'], 'precision' => $m['precision'], 'consistency' => $m['consistency'],
                'review_depth' => $m['review_depth'], 'total_pages' => $m['total_pages'],
                'sessions_count' => $m['sessions_count'], 'attendance_rate' => $m['attendance_rate'],
                'trend' => $m['trend_summary'], 'teachers' => $s->teachers->pluck('name')->values(),
                'last_session_date' => $last?->session_date,
                'prediction' => $this->ml->latest($s),
            ];
        })->values();

        $active = $rows->where('is_active', true);
        $withMastery = $active->pluck('mastery')->filter(fn ($v) => $v !== null);

        return [
            'circle' => ['circle_id' => $circle->circle_id, 'name' => $circle->name, 'location' => $circle->location, 'schedule_time' => $circle->schedule_time],
            'generated_at' => now()->toDateTimeString(),
            'totals' => [
                'students' => $active->count(),
                'suspended' => $rows->where('is_active', false)->count(),
                'teachers' => $circle->staff()->with('role')->get()->filter(fn ($u) => $u->roleCode() === 'TEACHER')->count(),
                'sessions' => (int) $active->sum('sessions_count'),
                'total_pages' => round((float) $active->sum('total_pages'), 2),
                'avg_mastery' => $withMastery->isEmpty() ? null : round((float) $withMastery->avg(), 1),
                'avg_attendance' => $active->isEmpty() ? null : round((float) $active->avg('attendance_rate') * 100, 1),
                'sessions_this_week' => $this->sessionsThisWeek($active->pluck('student_id')->all()),
            ],
            'improving' => $rows->where('trend.direction', 'UP')->pluck('name')->values(),
            'needs_attention' => $rows->filter(fn ($r) => $r['is_active'] && ($r['trend']['direction'] === 'DOWN' || ($r['consistency'] !== null && $r['consistency'] < 60)))
                ->sortBy('mastery')->values(),
            'students' => $rows,
        ];
    }

    private function sessionsThisWeek(array $studentIds): int
    {
        if (!$studentIds) return 0;

        return \App\Models\RecitationSession::whereIn('student_id', $studentIds)
            ->where('session_date', '>=', now()->startOfWeek()->toDateString())->count();
    }

    /** FR15 — PDF export; file is persisted under storage (only this service writes files). */
    public function studentPdf(Student $student, string $locale = 'ar'): string
    {
        $data = $this->studentReport($student, $locale) + ['doc_title' => $student->name];
        $path = "reports/student_{$student->student_id}_".now()->format('Ymd_His').'.pdf';
        Storage::put($path, $this->pdf->render('reports.student', $data, $locale, 'P'));

        return Storage::path($path);
    }

    public function circlePdf(Circle $circle, string $locale = 'ar'): string
    {
        $data = $this->circleReport($circle) + ['doc_title' => $circle->name];
        $path = "reports/circle_{$circle->circle_id}_".now()->format('Ymd_His').'.pdf';
        Storage::put($path, $this->pdf->render('reports.circle', $data, $locale, 'L'));

        return Storage::path($path);
    }
}
