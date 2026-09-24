<?php

namespace App\Http\Controllers;

use App\Models\ErrorType;
use App\Models\RecitationSession;
use App\Models\SessionError;
use App\Models\Student;
use App\Services\AnalyticsEngine;
use App\Services\GamificationEngine;
use App\Services\MlClient;
use App\Support\Surah;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Session Controller — FR4, FR5, FR6 (raw intake only).
 *
 * Two entry points, because a teacher does two different things:
 *
 *  - markAttendance() answers "who is here today" for the whole circle in one pass (FR4).
 *    It is deliberately outside the recitation form: taking the register is a roll-call, not
 *    a per-student recitation, and forcing it through the recitation screen was making the
 *    teacher open a full form to record an absence.
 *  - store() records the recitation itself (FR5, FR6) and fills in that day's row.
 *
 * Both write the same session row, because Table 4.1 allows exactly one session per student
 * per date and the register entry and the recitation describe the same session. Whichever
 * path writes it, the XP ledger is brought in line with the row as it now stands
 * (GamificationEngine::syncSessionXp), so the order in which a teacher does the two never
 * changes what the student earns.
 *
 * Flow after a recitation is saved (UC10): session + errors stored atomically →
 * Analytics (UC15) → ML (UC16) → Gamification (UC17) → Audit.
 */
class SessionController extends Controller
{
    /**
     * Attendance vocabulary: present, absent, excused.
     *
     * Table 4.1 admits (P, A, L, E) and the column still does — legacy rows carrying L keep
     * displaying correctly. L is no longer offered: every teacher interviewed treated a late
     * arrival as present, so the fourth option only produced inconsistent registers, and
     * "late" was never distinguished from "present" by consistency() or by any XP rule.
     */
    public const ATTENDANCE = ['P', 'A', 'E'];

    /** Session vocabulary: new memorization, or review (FR8/FR9 review depth). */
    public const TYPES = ['NEW', 'REVIEW'];

    /**
     * A session cannot be dated in the future. A mistyped year would otherwise create a
     * week that has not happened yet, and every weekly figure — momentum, the trend, the
     * streak — would be computed up to it.
     */
    private const DATE_RULE = 'required|date_format:Y-m-d|before_or_equal:today';

    public function errorTypes()
    {
        return response()->json(ErrorType::orderBy('error_type_id')->get());
    }

    /** The 114 Surahs with their ayah counts, so the client can offer a name list (FR5). */
    public function surahs()
    {
        $rows = [];
        foreach (Surah::ALL as $n => [$ar, $en, $ayahs]) {
            $rows[] = ['number' => $n, 'name_ar' => $ar, 'name_en' => $en, 'ayah_count' => $ayahs];
        }

        return response()->json($rows);
    }

    /**
     * FR4 — the register. One date, one status per student, several students at a time.
     * A student already recited that day keeps their recitation and only the status changes
     * — unless they are now marked absent, which clears it: an absent student recited nothing.
     */
    public function markAttendance(Request $r, AnalyticsEngine $analytics, GamificationEngine $g)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER', 'CIRCLE_ADMIN']);
        $d = $r->validate([
            'session_date' => self::DATE_RULE,
            'entries' => 'required|array|min:1',
            'entries.*.student_id' => 'required|integer|distinct|exists:student,student_id',
            'entries.*.attendance_status' => 'required|in:'.implode(',', self::ATTENDANCE),
        ]);

        $saved = DB::transaction(function () use ($d, $a, $g) {
            $rows = [];
            foreach ($d['entries'] as $e) {
                $student = Student::findOrFail($e['student_id']);
                $this->rbac->requireStudentManagement($a, $student);
                $session = RecitationSession::firstOrNew([
                    'student_id' => $student->student_id,
                    'session_date' => $d['session_date'],
                ]);
                if (!$session->exists) {
                    $session->fill(['user_id' => $a['id'], 'pages_memorized' => 0, 'session_type' => 'NEW']);
                }
                $session->attendance_status = $e['attendance_status'];
                if ($e['attendance_status'] === 'A') {
                    $this->clearRecitation($session);
                }
                $session->save();
                $g->syncSessionXp($student, $session);
                $this->audit->log($a, $session->wasRecentlyCreated ? 'CREATE' : 'UPDATE', 'session', $session->session_id,
                    ['student_id' => $student->student_id, 'field' => 'attendance_status', 'value' => $e['attendance_status']]);
                $rows[] = [$student, $session];
            }

            return $rows;
        });

        // FR12 — attendance badges (sessions attended, streaks) are earned from the register too.
        foreach ($saved as [$student]) {
            $g->evaluateBadges($student, $analytics->metrics($student));
        }

        return response()->json(['session_date' => $d['session_date'], 'saved' => count($saved), 'sessions' => array_column($saved, 1)]);
    }

    /** The register as it already stands for a given date, so the teacher sees what is recorded. */
    public function attendanceSheet(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER', 'CIRCLE_ADMIN']);
        $date = $r->validate(['session_date' => 'sometimes|date_format:Y-m-d'])['session_date'] ?? now()->toDateString();
        $students = $a['role'] === 'TEACHER'
            ? $a['model']->students()->where('is_active', true)->orderBy('name')->get()
            : Student::where('circle_id', $a['circle_id'])->where('is_active', true)->orderBy('name')->get();
        $existing = RecitationSession::withCount('errors')->whereIn('student_id', $students->pluck('student_id'))
            ->where('session_date', $date)->get()->keyBy('student_id');

        return response()->json([
            'session_date' => $date,
            'rows' => $students->map(fn ($s) => [
                'student_id' => $s->student_id,
                'name' => $s->name,
                'attendance_status' => $existing[$s->student_id]->attendance_status ?? null,
                'has_recitation' => isset($existing[$s->student_id]) && $existing[$s->student_id]->hasRecitation(),
            ])->values(),
        ]);
    }

    private function rules(): array
    {
        return [
            'session_date' => self::DATE_RULE,
            'attendance_status' => 'required|in:'.implode(',', self::ATTENDANCE),
            'surah_from' => 'nullable|integer|min:1|max:114', 'ayah_from' => 'nullable|integer|min:1|max:286',
            'surah_to' => 'nullable|integer|min:1|max:114', 'ayah_to' => 'nullable|integer|min:1|max:286',
            'pages_memorized' => 'required|numeric|min:0|max:99.99',
            'session_type' => 'nullable|in:'.implode(',', self::TYPES),
            'errors' => 'nullable|array|max:200',
            'errors.*.error_type_id' => 'required_with:errors|integer|exists:error_type,error_type_id',
            'errors.*.ayah_ref' => 'nullable|string|max:16',
        ];
    }

    /**
     * The ayah numbers are checked against the Surah actually chosen, not against a flat
     * 1..286: with a name picker in front of these fields, "Al-Fatihah ayah 100" is now a
     * typing slip the server can catch rather than a number nobody would notice.
     */
    private function checkRange(array $d): void
    {
        $n = fn (string $k) => isset($d[$k]) ? (int) $d[$k] : null;
        foreach ([['surah_from', 'ayah_from'], ['surah_to', 'ayah_to']] as [$sk, $ak]) {
            if ($n($sk) && $n($ak)) {
                abort_if($n($ak) > Surah::ayahCount($n($sk)), 422,
                    'Surah '.Surah::name($n($sk), 'en').' has only '.Surah::ayahCount($n($sk)).' ayahs.');
            }
        }
        if ($n('surah_from') && $n('surah_to')) {
            $backwards = $n('surah_to') < $n('surah_from')
                || ($n('surah_to') === $n('surah_from') && $n('ayah_to') && $n('ayah_from') && $n('ayah_to') < $n('ayah_from'));
            abort_if($backwards, 422, 'The end of the range comes before its start.');
        }
    }

    /**
     * The columns a request may write on a session. An absent student recited nothing, so an
     * absence carries no passage, no pages and no notes — whatever the form still held.
     */
    private function recitationFields(array $d): array
    {
        $absent = $d['attendance_status'] === 'A';

        return [
            'surah_from' => $absent ? null : ($d['surah_from'] ?? null), 'ayah_from' => $absent ? null : ($d['ayah_from'] ?? null),
            'surah_to' => $absent ? null : ($d['surah_to'] ?? null), 'ayah_to' => $absent ? null : ($d['ayah_to'] ?? null),
            'pages_memorized' => $absent ? 0 : $d['pages_memorized'],
            'attendance_status' => $d['attendance_status'],
        ];
    }

    private function clearRecitation(RecitationSession $s): void
    {
        $s->fill(['surah_from' => null, 'ayah_from' => null, 'surah_to' => null, 'ayah_to' => null, 'pages_memorized' => 0]);
        if ($s->exists) {
            SessionError::where('session_id', $s->session_id)->delete();
        }
    }

    /** Replaces the notes on a session with the list the teacher submitted. */
    private function writeErrors(RecitationSession $s, array $d): int
    {
        SessionError::where('session_id', $s->session_id)->delete();
        $errors = $d['attendance_status'] === 'A' ? [] : ($d['errors'] ?? []);
        foreach ($errors as $e) {
            SessionError::create(['session_id' => $s->session_id, 'error_type_id' => $e['error_type_id'], 'ayah_ref' => $e['ayah_ref'] ?? null]);
        }

        return count($errors);
    }

    public function store(Request $r, AnalyticsEngine $analytics, MlClient $ml, GamificationEngine $g)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER']);
        $d = $r->validate($this->rules() + [
            'student_id' => 'required|integer|exists:student,student_id',
            'client_uuid' => 'nullable|string|max:64',
        ]);
        $this->checkRange($d);
        $student = Student::findOrFail($d['student_id']);
        $this->rbac->requireStudentManagement($a, $student);

        // The register may already hold today's row for this student. That is not a clash:
        // it is the same session, so the recitation fills it in instead of being refused.
        $existing = RecitationSession::where('student_id', $student->student_id)->where('session_date', $d['session_date'])->first();
        abort_if($existing?->hasRecitation(), 409, 'A recitation is already recorded for this student on this date. Open it to edit instead.');

        $session = DB::transaction(function () use ($d, $a, $student, $existing, $g) {
            $s = $existing ?? new RecitationSession(['student_id' => $student->student_id, 'session_date' => $d['session_date']]);
            $s->fill($this->recitationFields($d) + ['user_id' => $a['id'], 'session_type' => $d['session_type'] ?? 'NEW'])->save();
            $errors = $this->writeErrors($s, $d);
            $g->syncSessionXp($student, $s);
            $this->audit->log($a, 'CREATE', 'session', $s->session_id, ['student_id' => $student->student_id, 'errors' => $errors, 'pages' => $s->pages_memorized, 'client_uuid' => $d['client_uuid'] ?? null]);

            return $s;
        });

        // UC15 recompute (on read), UC16 forecast (fallback-safe), UC17 badges and challenges
        $metrics = $analytics->metrics($student);
        $prediction = $ml->forecast($student, $metrics);
        $awards = $g->onSessionSaved($student, $session, $metrics);

        return response()->json([
            'session' => $session->load('errors.errorType'),
            'metrics' => $metrics,
            'prediction' => $prediction ?? $ml->latest($student),
            'prediction_stale' => $prediction === null,
            'awards' => $awards,
        ], 201);
    }

    /**
     * Correct a session that was entered wrongly. Every hand-typed figure in this system is
     * correctable; the audit row keeps the correction visible (FR18).
     *
     * The error rows are replaced wholesale rather than patched, because the teacher edits
     * the list of mistakes as a list. XP already awarded is never rewritten: xp_ledger is
     * append-only (Table 4.1), so a correction that changes the page count or the attendance
     * is settled by a compensating entry.
     */
    public function update(Request $r, int $id, AnalyticsEngine $analytics, MlClient $ml, GamificationEngine $g)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER', 'CIRCLE_ADMIN']);
        $s = RecitationSession::findOrFail($id);
        $student = $s->student;
        $this->rbac->requireStudentManagement($a, $student);
        $d = $r->validate($this->rules());
        $this->checkRange($d);

        abort_if(RecitationSession::where('student_id', $s->student_id)->where('session_date', $d['session_date'])
            ->where('session_id', '!=', $s->session_id)->exists(), 409, 'Another session already exists for this student on that date');

        $before = ['pages' => (float) $s->pages_memorized, 'date' => (string) $s->session_date, 'attendance' => $s->attendance_status];
        DB::transaction(function () use ($d, $s, $a, $student, $before, $g) {
            $s->fill($this->recitationFields($d) + ['session_date' => $d['session_date'], 'session_type' => $d['session_type'] ?? $s->session_type])->save();
            $this->writeErrors($s, $d);
            $g->syncSessionXp($student, $s);
            $this->audit->log($a, 'UPDATE', 'session', $s->session_id, ['student_id' => $s->student_id, 'before' => $before,
                'after' => ['pages' => (float) $s->pages_memorized, 'date' => (string) $s->session_date, 'attendance' => $s->attendance_status]]);
        });

        $metrics = $analytics->metrics($student);
        $ml->forecast($student, $metrics);

        return response()->json(['session' => $s->fresh()->load('errors.errorType'), 'metrics' => $metrics]);
    }

    public function destroy(Request $r, int $id, GamificationEngine $g)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN', 'TEACHER']);
        $s = RecitationSession::findOrFail($id);
        $student = $s->student;
        $this->rbac->requireStudentManagement($a, $student);

        DB::transaction(function () use ($s, $student, $a, $g) {
            // The XP this session earned is cancelled by a compensating entry BEFORE the row
            // goes, because xp_ledger.session_id is SET NULL on delete (Table 4.1) and the
            // entries would otherwise be unattributable — and the student would keep points
            // for a session that no longer exists.
            $g->settleXpForSession($student, null, $s->session_id);
            $s->delete(); // cascades to session_error
            $this->audit->log($a, 'DELETE', 'session', $s->session_id, ['student_id' => $s->student_id]);
        });

        return response()->json(['deleted' => true]);
    }
}
