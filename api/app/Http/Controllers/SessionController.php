<?php

namespace App\Http\Controllers;

use App\Models\ErrorType;
use App\Models\RecitationSession;
use App\Models\SessionError;
use App\Models\Student;
use App\Services\AnalyticsEngine;
use App\Services\GamificationEngine;
use App\Services\MlClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Session Controller — FR4, FR5, FR6 (raw intake only).
 * Flow on save (UC10): store session + errors atomically → Analytics (UC15) → ML (UC16) → Gamification (UC17) → Audit.
 */
class SessionController extends Controller
{
    public function errorTypes()
    {
        return response()->json(ErrorType::orderBy('error_type_id')->get());
    }

    public function store(Request $r, AnalyticsEngine $analytics, MlClient $ml, GamificationEngine $g)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER']);
        $d = $r->validate([
            'student_id' => 'required|integer|exists:student,student_id',
            'session_date' => 'required|date',
            'attendance_status' => 'required|in:P,A,L,E',
            'surah_from' => 'nullable|integer|min:1|max:114', 'ayah_from' => 'nullable|integer|min:1|max:286',
            'surah_to' => 'nullable|integer|min:1|max:114', 'ayah_to' => 'nullable|integer|min:1|max:286',
            'pages_memorized' => 'required|numeric|min:0|max:99.99',
            'session_type' => 'nullable|in:NEW,REVIEW,MIXED',
            'errors' => 'nullable|array',
            'errors.*.error_type_id' => 'required_with:errors|integer|exists:error_type,error_type_id',
            'errors.*.ayah_ref' => 'nullable|string|max:16',
            'client_uuid' => 'nullable|string|max:64',
        ]);
        $student = Student::findOrFail($d['student_id']);
        $this->rbac->requireStudentManagement($a, $student);
        abort_if(RecitationSession::where('student_id', $student->student_id)->where('session_date', $d['session_date'])->exists(), 409, 'A session already exists for this student on this date');

        // Atomic: session + session_error + audit row
        $session = DB::transaction(function () use ($d, $a, $student) {
            $s = RecitationSession::create([
                'student_id' => $student->student_id, 'user_id' => $a['id'], 'session_date' => $d['session_date'],
                'surah_from' => $d['surah_from'] ?? null, 'ayah_from' => $d['ayah_from'] ?? null, 'surah_to' => $d['surah_to'] ?? null, 'ayah_to' => $d['ayah_to'] ?? null,
                'pages_memorized' => $d['attendance_status'] === 'A' ? 0 : $d['pages_memorized'], 'attendance_status' => $d['attendance_status'], 'session_type' => $d['session_type'] ?? 'NEW',
            ]);
            foreach ($d['errors'] ?? [] as $e) {
                SessionError::create(['session_id' => $s->session_id, 'error_type_id' => $e['error_type_id'], 'ayah_ref' => $e['ayah_ref'] ?? null]);
            }
            $this->audit->log($a, 'CREATE', 'session', $s->session_id, ['student_id' => $student->student_id, 'errors' => count($d['errors'] ?? []), 'pages' => $s->pages_memorized, 'client_uuid' => $d['client_uuid'] ?? null]);
            return $s;
        });

        // UC15 recompute (on read), UC16 forecast (fallback-safe), UC17 XP
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

    public function destroy(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER']);
        $s = RecitationSession::findOrFail($id);
        $this->rbac->requireStudentManagement($a, $s->student);
        $s->delete(); // cascades to session_error; xp_ledger.session_id → NULL
        $this->audit->log($a, 'DELETE', 'session', $id, ['student_id' => $s->student_id]);
        return response()->json(['deleted' => true]);
    }
}
