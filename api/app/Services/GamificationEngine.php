<?php

namespace App\Services;

use App\Models\Badge;
use App\Models\Circle;
use App\Models\RecitationSession;
use App\Models\Student;
use App\Models\SystemSetting;
use App\Models\XpLedger;
use Illuminate\Support\Facades\DB;

/** Gamification Engine — FR11, FR12, FR13. XP is append-only; totals are SUM(points), never a column. */
class GamificationEngine
{
    public function __construct(private AnalyticsEngine $analytics) {}

    public function totalXp(int $studentId): int
    {
        return (int) XpLedger::where('student_id', $studentId)->sum('points');
    }

    private function award(Student $student, ?int $sessionId, int $points, string $reason): void
    {
        if ($points <= 0) return;
        XpLedger::create(['student_id' => $student->student_id, 'session_id' => $sessionId, 'points' => $points, 'reason' => $reason, 'created_at' => now()]);
    }

    /** FR13 — XP for a saved session, then FR12 badges and UC23 challenge progress. Returns what was awarded. */
    public function onSessionSaved(Student $student, RecitationSession $session, array $metrics): array
    {
        $perPage = (int) SystemSetting::num('xp_per_page', 10);
        $perSession = (int) SystemSetting::num('xp_per_session', 5);
        $this->award($student, $session->session_id, (int) round($session->pages_memorized * $perPage), 'PAGE_MEMORIZED');
        if (in_array($session->attendance_status, ['P', 'L'], true)) {
            $this->award($student, $session->session_id, $perSession, 'SESSION_ATTENDED');
        }
        $completed = $this->progressChallenges($student, $session);
        $badges = $this->evaluateBadges($student, $metrics);
        return ['xp_total' => $this->totalXp($student->student_id), 'new_badges' => $badges, 'completed_challenges' => $completed];
    }

    /** FR12 — automatic badge evaluation. Composite PK prevents earning twice. */
    public function evaluateBadges(Student $student, array $metrics): array
    {
        $owned = $student->badges()->pluck('badge.badge_id')->all();
        $attended = $student->sessions()->whereIn('attendance_status', ['P', 'L'])->count();
        $xp = $this->totalXp($student->student_id);
        $streak = $this->currentStreak($student);
        $earned = [];
        foreach (Badge::whereNotIn('badge_id', $owned)->get() as $b) {
            $met = match ($b->condition_type) {
                'PAGES_TOTAL' => ($metrics['total_pages'] ?? 0) >= $b->condition_value,
                'SESSIONS_ATTENDED' => $attended >= $b->condition_value,
                'MASTERY_MIN' => ($metrics['mastery'] ?? 0) >= $b->condition_value && ($metrics['sessions_count'] ?? 0) >= 3,
                'XP_TOTAL' => $xp >= $b->condition_value,
                'STREAK_SESSIONS' => $streak >= $b->condition_value,
                default => false,
            };
            if ($met) {
                $student->badges()->attach($b->badge_id, ['earned_at' => now()]);
                $earned[] = $b;
            }
        }
        return $earned;
    }

    private function currentStreak(Student $student): int
    {
        $n = 0;
        foreach ($student->sessions()->orderByDesc('session_date')->pluck('attendance_status') as $st) {
            if (in_array($st, ['P', 'L'], true)) $n++; else break;
        }
        return $n;
    }

    /** UC23 — progress ACTIVE challenges by pages; complete and award xp_reward. */
    private function progressChallenges(Student $student, RecitationSession $session): array
    {
        $completed = [];
        foreach ($student->challenges()->wherePivot('status', 'ACTIVE')->get() as $c) {
            $deadline = \Carbon\Carbon::parse($c->pivot->started_at)->addDays($c->duration_days);
            if (now()->gt($deadline)) {
                $student->challenges()->updateExistingPivot($c->challenge_id, ['status' => 'EXPIRED']);
                continue;
            }
            $progress = min($c->target_value, $c->pivot->progress + (int) round($session->pages_memorized));
            $update = ['progress' => $progress];
            if ($progress >= $c->target_value) {
                $update += ['status' => 'COMPLETED', 'completed_at' => now()];
                $this->award($student, $session->session_id, $c->xp_reward, 'CHALLENGE_COMPLETED');
                $completed[] = $c;
            }
            $student->challenges()->updateExistingPivot($c->challenge_id, $update);
        }
        return $completed;
    }

    /** FR11 — one ranking per criterion, per circle. Never combined. */
    public function leaderboard(Circle $circle, string $criterion): array
    {
        $rows = [];
        foreach ($circle->students()->where('is_active', true)->get() as $s) {
            $m = $this->analytics->metrics($s);
            $value = $m[$criterion];
            if ($value === null) continue;
            $rows[] = ['student_id' => $s->student_id, 'name' => $s->name, 'value' => $value];
        }
        usort($rows, fn ($a, $b) => $b['value'] <=> $a['value']);
        foreach ($rows as $i => &$r) $r['rank'] = $i + 1;
        return $rows;
    }
}
