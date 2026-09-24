<?php

namespace App\Services;

use App\Models\RecitationSession;
use App\Models\Student;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Analytics Engine — FR7, FR8, FR9. Everything is computed on read from session + session_error.
 * All constants are PROVISIONAL and calibrated in CPIT-499 (editable via system_setting).
 */
class AnalyticsEngine
{
    public const HIGH_SEVERITY = ['MEM_GAP', 'LNK_ERR'];

    /** Provisional: pages per Juz — mirrored by PAGES_PER_JUZ in ml/main.py and ml/evaluation.py. */
    public const PAGES_PER_JUZ = 20;

    /** Settings read once per engine instance: the trend alone evaluates Mastery once per week. */
    private array $settings = [];

    private function setting(string $key, float $default): float
    {
        return $this->settings[$key] ??= SystemSetting::num($key, $default);
    }

    /** d_max is a divisor. It is validated on write (UC3); this only keeps a bad row from being a 500. */
    private function dMax(): float
    {
        $dMax = $this->setting('d_max', 3.0);

        return $dMax > 0 ? $dMax : 3.0;
    }

    private function sessions(Student $student): Collection
    {
        return $student->sessions()->with('errors.errorType')->orderBy('session_date')->orderBy('session_id')->get();
    }

    /**
     * The most recent sessions by DATE. Ordering by session_id instead would treat a session
     * entered late — a register filled in for last week, or an offline queue synced days
     * afterwards — as the newest one, and push genuinely recent sessions out of the window.
     */
    private function latest(Collection $sessions, int $n): Collection
    {
        return $sessions->sortBy([['session_date', 'desc'], ['session_id', 'desc']])->take($n);
    }

    // §3.1 weighted error load
    public function errorLoad(RecitationSession $s): float
    {
        return round($s->errors->sum(fn ($e) => (float) $e->errorType->weight), 4);
    }

    // §3.2 error density — undefined when pages = 0
    public function errorDensity(RecitationSession $s): ?float
    {
        return $s->pages_memorized > 0 ? $this->errorLoad($s) / $s->pages_memorized : null;
    }

    // §3.3 mastery over the last 8 sessions
    public function mastery(Collection $sessions): ?float
    {
        $densities = $this->latest($sessions, 8)->map(fn ($s) => $this->errorDensity($s))->filter(fn ($d) => $d !== null);
        if ($densities->isEmpty()) return null;
        $dMean = $densities->avg();
        return round(100 * (1 - min(1, $dMean / $this->dMax())), 1);
    }

    /**
     * The §3.3 formula applied to one session, so a history row can show how accurate that
     * day's recitation was as a plain percentage instead of the weighted load E(s).
     * It is the same arithmetic, not a second measure.
     */
    public function sessionAccuracy(RecitationSession $s): ?float
    {
        $d = $this->errorDensity($s);
        if ($d === null) return null;

        return round(100 * (1 - min(1, $d / $this->dMax())), 1);
    }

    /** Pages per ISO week, filled from the first session week to the current week. */
    public function weeklyPages(Collection $sessions, ?callable $filter = null): array
    {
        if ($sessions->isEmpty()) return [];
        $start = Carbon::parse($sessions->first()->session_date)->startOfWeek();
        $end = Carbon::now()->startOfWeek();
        $weeks = [];
        for ($w = $start->copy(); $w <= $end; $w->addWeek()) $weeks[$w->toDateString()] = 0.0;
        foreach ($sessions as $s) {
            if ($filter && !$filter($s)) continue;
            $k = Carbon::parse($s->session_date)->startOfWeek()->toDateString();
            $weeks[$k] = ($weeks[$k] ?? 0) + (float) $s->pages_memorized;
        }
        return $weeks;
    }

    // §3.4 momentum EWMA
    public function momentum(Collection $sessions): float
    {
        $alpha = $this->setting('alpha', 0.4);
        $ewma = null;
        foreach ($this->weeklyPages($sessions) as $pages) {
            $ewma = $ewma === null ? $pages : $alpha * $pages + (1 - $alpha) * $ewma;
        }
        return round($ewma ?? 0, 2);
    }

    // §3.5 precision
    public function precision(Collection $sessions): ?float
    {
        if ($sessions->isEmpty()) return null;
        $total = 0.0; $high = 0.0;
        foreach ($sessions as $s) {
            foreach ($s->errors as $e) {
                $w = (float) $e->errorType->weight;
                $total += $w;
                if (in_array($e->errorType->code, self::HIGH_SEVERITY, true)) $high += $w;
            }
        }
        if ($total == 0) return 100.0;
        return round(100 * (1 - $high / $total), 1);
    }

    // §3.6 consistency over the last 8 scheduled sessions
    public function consistency(Collection $sessions): ?float
    {
        $last = $this->latest($sessions, 8);
        if ($last->isEmpty()) return null;
        $attended = $last->filter(fn ($s) => in_array($s->attendance_status, ['P', 'L'], true))->count();
        return round($attended / $last->count() * 100, 1);
    }

    // §3.7 review depth over the last 4 weeks (uses session_type — [BUILD] decision I2)
    public function reviewDepth(Collection $sessions): ?float
    {
        $since = Carbon::now()->subWeeks(4)->toDateString();
        $recent = $sessions->filter(fn ($s) => $s->session_date >= $since);
        $new = 0.0; $review = 0.0;
        foreach ($recent as $s) {
            $p = (float) $s->pages_memorized;
            match ($s->session_type) {
                'REVIEW' => $review += $p,
                'MIXED' => [$new += $p / 2, $review += $p / 2],
                default => $new += $p,
            };
        }
        // Undefined with no new pages to divide by — the student is excluded from the
        // review-depth leaderboard rather than being ranked on a fabricated number.
        if ($new == 0) return null;
        return round($review / $new, 2);
    }

    public function attendanceRate(Collection $sessions): float
    {
        if ($sessions->isEmpty()) return 0.0;
        return round($sessions->filter(fn ($s) => in_array($s->attendance_status, ['P', 'L'], true))->count() / $sessions->count(), 3);
    }

    public function meanErrorDensity(Collection $sessions): float
    {
        $d = $sessions->map(fn ($s) => $this->errorDensity($s))->filter(fn ($x) => $x !== null);
        return $d->isEmpty() ? 0.0 : round($d->avg(), 3);
    }

    public function totalNewPages(Collection $sessions): float
    {
        return $sessions->sum(fn ($s) => match ($s->session_type) { 'REVIEW' => 0, 'MIXED' => $s->pages_memorized / 2, default => $s->pages_memorized });
    }

    /**
     * Week-by-week progress line — the rising or falling curve on the student screens.
     *
     * Two series, both already defined by the report, plotted against the same weeks:
     *   pages — new and reviewed pages recorded that week (FR8's raw input);
     *   level — the §3.3 Mastery formula evaluated as at the end of that week, over the
     *           eight sessions up to that point.
     *
     * The line climbs when errors per page fall and stays up while they stay low, and the
     * bars grow as the student covers more pages. No new coefficient is introduced: every
     * number here comes out of a formula already listed in Table 3.4, so the graph adds a
     * view of the data and not another provisional constant to defend.
     */
    public function trend(Collection $sessions): array
    {
        if ($sessions->isEmpty()) return [];
        $ordered = $sessions->sortBy('session_date')->values();

        // Each session's week is resolved once. Parsing the date inside the per-week loop
        // instead made this O(weeks x sessions) Carbon parses, and the circle dashboard runs
        // it for every student on the page.
        $byWeek = [];
        foreach ($ordered as $s) {
            $byWeek[Carbon::parse($s->session_date)->startOfWeek()->toDateString()][] = $s;
        }

        $weeks = [];
        $upTo = collect();
        foreach ($this->weeklyPages($ordered) as $week => $pages) {
            $inWeek = collect($byWeek[$week] ?? []);
            // Sessions accumulate as the weeks advance, so the level at the end of each week
            // is the §3.3 formula over everything recorded up to that point.
            $upTo = $upTo->concat($inWeek);
            $weeks[] = [
                'week' => $week,
                'pages' => round((float) $pages, 2),
                'level' => $this->mastery($upTo),
                'errors' => (int) $inWeek->sum(fn ($s) => $s->errors->count()),
                'sessions' => $inWeek->count(),
            ];
        }

        return $weeks;
    }

    /**
     * Plain reading of that curve: is the student climbing, holding steady, or slipping?
     *
     * The last four weeks are compared with the four before them, on both series. A change
     * smaller than three points of level and a quarter of a page a week is called steady,
     * so ordinary week-to-week noise is not reported to a child as a decline.
     */
    public function trendDirection(array $trend): array
    {
        $recent = array_slice($trend, -4);
        $earlier = array_slice($trend, -8, 4);
        $mean = function (array $rows, string $key): ?float {
            $vals = array_values(array_filter(array_column($rows, $key), fn ($v) => $v !== null));
            return $vals ? array_sum($vals) / count($vals) : null;
        };
        if (count($trend) < 4 || !$earlier) {
            return ['direction' => 'NEW', 'level_change' => null, 'pages_change' => null];
        }
        $dLevel = ($mean($recent, 'level') ?? 0) - ($mean($earlier, 'level') ?? 0);
        $dPages = ($mean($recent, 'pages') ?? 0) - ($mean($earlier, 'pages') ?? 0);
        $up = $dLevel > 3 || $dPages > 0.25;
        $down = $dLevel < -3 || $dPages < -0.25;

        return [
            'direction' => $up && !$down ? 'UP' : ($down && !$up ? 'DOWN' : 'STEADY'),
            'level_change' => round($dLevel, 1),
            'pages_change' => round($dPages, 2),
        ];
    }

    /** Full metric bundle for a student (FR7–FR9). */
    public function metrics(Student $student): array
    {
        $sessions = $this->sessions($student);
        $newPages = $this->totalNewPages($sessions);
        $trend = $this->trend($sessions);
        return [
            'student_id' => $student->student_id,
            'trend' => $trend,
            'trend_summary' => $this->trendDirection($trend),
            'error_count' => (int) $sessions->sum(fn ($s) => $s->errors->count()),
            'mastery' => $this->mastery($sessions),
            'momentum' => $this->momentum($sessions),
            'precision' => $this->precision($sessions),
            'consistency' => $this->consistency($sessions),
            'review_depth' => $this->reviewDepth($sessions),
            'attendance_rate' => $this->attendanceRate($sessions),
            'error_density' => $this->meanErrorDensity($sessions),
            'sessions_count' => $sessions->count(),
            'total_pages' => round((float) $sessions->sum('pages_memorized'), 2),
            'total_new_pages' => round($newPages, 2),
            'pages_in_current_juz' => round(fmod($newPages, self::PAGES_PER_JUZ), 2),
            'weekly_pages' => $this->weeklyPages($sessions),
            'last_session_date' => $sessions->isEmpty() ? null : (string) $sessions->max('session_date'),
            'constants' => ['d_max' => $this->dMax(), 'alpha' => $this->setting('alpha', 0.4), 'provisional' => true],
        ];
    }
}
