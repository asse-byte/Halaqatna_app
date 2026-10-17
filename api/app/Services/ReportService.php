<?php

namespace App\Services;

use App\Models\Circle;
use App\Models\RecitationSession;
use App\Models\Student;
use App\Support\MasteryBand;
use App\Support\Surah;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;

/** Report Service — FR14, FR15. The ONLY component that writes to file storage. */
class ReportService
{
    /** Weeks on the dashboards' attendance chart — the window trendDirection() compares, four against four. */
    private const SUMMARY_WEEKS = 8;

    public function __construct(
        private AnalyticsEngine $analytics,
        private GamificationEngine $gamification,
        private MlClient $ml,
        private PdfRenderer $pdf,
    ) {}

    public function studentReport(Student $student, string $locale = 'ar'): array
    {
        $sessions = $student->sessions()->with('errors.errorType', 'teacher')->orderByDesc('session_date')->get();
        $metrics = $this->analytics->metrics($student);

        return [
            // Teachers by name only: this report is also served to the student and, as a PDF,
            // to their guardian — neither has any business with a teacher's email or address.
            'student' => $student->load('circle', 'teachers:user_id,name'),
            'metrics' => $metrics,
            'band' => MasteryBand::for($metrics['mastery']),
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
                'mastery' => $m['mastery'], 'band' => MasteryBand::for($m['mastery']), 'momentum' => $m['momentum'],
                'precision' => $m['precision'], 'consistency' => $m['consistency'],
                'review_depth' => $m['review_depth'], 'total_pages' => $m['total_pages'], 'sessions_count' => $m['sessions_count'],
                'attendance_rate' => $m['attendance_rate'], 'error_count' => $m['error_count'],
                'trend' => $m['trend_summary']['direction'],
                'xp_total' => $this->gamification->totalXp($s->student_id)];
        })->values();
        // Averages are taken over students with at least one recorded session. A student
        // enrolled yesterday has a pace of 0 only because nothing is recorded yet, and counting
        // it would pull the circle's figure down for no reason. Nothing to average is null,
        // not 0: the screen and the PDF both print a dash for null.
        $recorded = $students->where('sessions_count', '>', 0);
        $avg = function ($k) use ($recorded) {
            $vals = $recorded->pluck($k)->filter(fn ($v) => $v !== null);
            return $vals->isEmpty() ? null : round((float) $vals->avg(), 1);
        };
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
            return [
                'student_id' => $s->student_id, 'name' => $s->name, 'current_juz' => $s->current_juz,
                'is_active' => (bool) $s->is_active,
                'mastery' => $m['mastery'], 'band' => MasteryBand::for($m['mastery']),
                'momentum' => $m['momentum'], 'precision' => $m['precision'], 'consistency' => $m['consistency'],
                'review_depth' => $m['review_depth'], 'total_pages' => $m['total_pages'],
                'sessions_count' => $m['sessions_count'], 'attendance_rate' => $m['attendance_rate'],
                'trend' => $m['trend_summary'], 'teachers' => $s->teachers->pluck('name')->values(),
                'last_session_date' => $m['last_session_date'],
                'prediction' => $this->ml->latest($s),
            ];
        })->values();

        $active = $rows->where('is_active', true);
        $withMastery = $active->pluck('mastery')->filter(fn ($v) => $v !== null);
        $marked = $active->where('sessions_count', '>', 0);

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
                // Over students with a register to read: one with no rows yet has an attendance
                // rate of 0 only because nothing is recorded, as Mastery is null for them above.
                'avg_attendance' => $marked->isEmpty() ? null : round((float) $marked->avg('attendance_rate') * 100, 1),
                'sessions_this_week' => $this->sessionsThisWeek($active->pluck('student_id')->all()),
            ],
            'weekly_attendance' => $this->weeklyAttendance($active->pluck('student_id')->all()),
            'improving' => $active->where('trend.direction', 'UP')->pluck('name')->values(),
            'needs_attention' => $rows->filter(fn ($r) => $r['is_active'] && ($r['trend']['direction'] === 'DOWN' || ($r['consistency'] !== null && $r['consistency'] < 60)))
                ->sortBy('mastery')->values(),
            'students' => $rows,
        ];
    }

    /**
     * The register week by week, for the summary chart on both dashboards: of the rows marked
     * for these students that week, the share attended. Present and legacy late count as
     * attended and absent and excused do not — the same rule as attendanceRate(). The bars
     * count register rows, so a student with no rows yet adds nothing to any week.
     *
     * The window is the eight weeks trendDirection() already compares (four against four).
     * A week with nothing marked is null rather than 0%: no register is not everyone absent.
     */
    private function weeklyAttendance(array $studentIds): array
    {
        $start = now()->startOfWeek()->subWeeks(self::SUMMARY_WEEKS - 1);
        $rows = $studentIds
            ? RecitationSession::whereIn('student_id', $studentIds)->where('session_date', '>=', $start->toDateString())->get(['session_date', 'attendance_status'])
            : collect();
        $byWeek = $rows->groupBy(fn ($s) => Carbon::parse($s->session_date)->startOfWeek()->toDateString());

        $weeks = [];
        for ($w = $start->copy(); $w <= now(); $w->addWeek()) {
            $in = $byWeek->get($w->toDateString(), collect());
            $attended = $in->filter->attended()->count();
            $weeks[] = ['week' => $w->toDateString(), 'marked' => $in->count(), 'attended' => $attended,
                'rate' => $in->isEmpty() ? null : round($attended / $in->count() * 100, 1)];
        }

        return $weeks;
    }

    private function sessionsThisWeek(array $studentIds): int
    {
        if (!$studentIds) return 0;

        return RecitationSession::whereIn('student_id', $studentIds)
            ->where('session_date', '>=', now()->startOfWeek()->toDateString())->count();
    }

    /**
     * FR15 — PDF export. Returns the PDF itself, and keeps the latest copy of each report
     * under storage (this service is the only writer to file storage, §6).
     *
     * One file per report and language, overwritten on each export. The first build wrote
     * a new timestamped file on every request and never removed one, and the guardian's
     * link (GET /p/{token}/report.pdf) is public — so every tap on a shared link grew the
     * disk without bound. The response is built from the bytes in memory rather than by
     * re-reading the file, so two exports of the same report can never serve a half-written one.
     */
    public function studentPdf(Student $student, string $locale = 'ar'): string
    {
        $data = $this->studentReport($student, $locale) + ['doc_title' => $student->name];

        return $this->store("reports/student_{$student->student_id}_{$locale}.pdf", $this->pdf->render('reports.student', $data, $locale, 'P'));
    }

    public function circlePdf(Circle $circle, string $locale = 'ar'): string
    {
        $data = $this->circleReport($circle) + ['doc_title' => $circle->name];

        return $this->store("reports/circle_{$circle->circle_id}_{$locale}.pdf", $this->pdf->render('reports.circle', $data, $locale, 'L'));
    }

    private function store(string $path, string $pdf): string
    {
        Storage::put($path, $pdf);

        return $pdf;
    }
}
