<?php

namespace App\Http\Controllers;

use App\Models\Challenge;
use App\Models\Student;
use App\Models\StaffUser;
use App\Models\XpLedger;
use App\Services\AnalyticsEngine;
use App\Services\GamificationEngine;
use App\Services\MlClient;
use App\Services\ReportService;
use Illuminate\Http\Request;

/** UC5 roster, UC12/UC19–UC23 student reads. Access decisions are delegated to AuthRbacService. */
class StudentController extends Controller
{
    private function studentFor(Request $r, int $id): Student
    {
        $s = Student::findOrFail($id);
        $this->rbac->requireStudentAccess($this->actor($r), $s);
        return $s;
    }

    /** Staff list: teachers see their assigned students; admins see their circle; sys admin sees all. */
    public function index(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER']);
        if ($a['role'] === 'TEACHER') {
            return response()->json($a['model']->students()->with('circle:circle_id,name')->orderBy('name')->get());
        }
        $q = Student::with('circle:circle_id,name', 'teachers:user_id,name');
        if ($scope = $this->rbac->scopeCircleId($a)) $q->where('circle_id', $scope);
        return response()->json($q->orderBy('name')->get());
    }

    public function show(Request $r, int $id)
    {
        return response()->json($this->studentFor($r, $id)->load('circle', 'teachers:user_id,name'));
    }

    // FR20 — create student in circle (Circle Admin, Teacher for own circle)
    public function store(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER']);
        $d = $r->validate(['name' => 'required|string|max:120', 'circle_id' => 'required|integer|exists:circle,circle_id', 'current_juz' => 'nullable|integer|min:1|max:30',
            'locale' => 'nullable|in:ar,en', 'teacher_ids' => 'nullable|array', 'teacher_ids.*' => 'integer|exists:staff_user,user_id']);
        $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        $s = Student::create(['name' => $d['name'], 'circle_id' => $d['circle_id'], 'current_juz' => $d['current_juz'] ?? 1, 'locale' => $d['locale'] ?? 'ar', 'access_code' => $this->rbac->generateAccessCode()]);
        $teacherIds = $d['teacher_ids'] ?? ($a['role'] === 'TEACHER' ? [$a['id']] : []);
        $this->assignTeachers($s, $teacherIds);
        $this->audit->log($a, 'CREATE', 'student', $s->student_id, ['circle_id' => $s->circle_id, 'teacher_ids' => $teacherIds]);
        return response()->json($s->load('teachers:user_id,name'), 201);
    }

    // FR20 — suspend / reassign
    public function update(Request $r, int $id)
    {
        $a = $this->actor($r);
        $s = Student::findOrFail($id);
        $this->rbac->requireStudentManagement($a, $s);
        $d = $r->validate(['name' => 'sometimes|string|max:120', 'is_active' => 'sometimes|boolean', 'current_juz' => 'sometimes|integer|min:1|max:30', 'locale' => 'sometimes|in:ar,en',
            'circle_id' => 'sometimes|integer|exists:circle,circle_id', 'teacher_ids' => 'sometimes|array', 'teacher_ids.*' => 'integer|exists:staff_user,user_id']);
        if (isset($d['circle_id']) || isset($d['is_active'])) $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        if (isset($d['circle_id'])) $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        if (array_key_exists('teacher_ids', $d)) {
            $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
            $this->assignTeachers($s, $d['teacher_ids'], true);
        }
        $s->update(collect($d)->except('teacher_ids')->all());
        $this->audit->log($a, 'UPDATE', 'student', $s->student_id, collect($d)->all());
        return response()->json($s->load('teachers:user_id,name'));
    }

    private function assignTeachers(Student $s, array $ids, bool $sync = false): void
    {
        $teachers = StaffUser::with('role')->whereIn('user_id', $ids)->get();
        foreach ($teachers as $t) {
            abort_if($t->roleCode() !== 'TEACHER', 422, "User {$t->name} is not a teacher");
            abort_if((int) $t->circle_id !== (int) $s->circle_id, 422, "Teacher {$t->name} belongs to another circle");
        }
        $sync ? $s->teachers()->sync($ids) : $s->teachers()->syncWithoutDetaching($ids);
    }

    // FR7–FR9
    public function metrics(Request $r, int $id, AnalyticsEngine $analytics, GamificationEngine $g)
    {
        $s = $this->studentFor($r, $id);
        return response()->json($analytics->metrics($s) + ['xp_total' => $g->totalXp($s->student_id)]);
    }

    // FR10 / UC13 — with staleness fallback
    public function prediction(Request $r, int $id, MlClient $ml, AnalyticsEngine $analytics)
    {
        $s = $this->studentFor($r, $id);
        $fresh = $r->boolean('refresh') ? $ml->forecast($s, $analytics->metrics($s)) : null;
        $p = $fresh ?? $ml->latest($s);
        if (!$p) return response()->json(['prediction' => null, 'stale' => true, 'ml_available' => $fresh !== null]);
        return response()->json(['prediction' => $p, 'stale' => $fresh === null, 'generated_at' => $p->generated_at, 'ml_available' => $fresh !== null]);
    }

    public function sessions(Request $r, int $id, AnalyticsEngine $analytics)
    {
        $s = $this->studentFor($r, $id);
        $rows = $s->sessions()->with('errors.errorType', 'teacher:user_id,name')->orderByDesc('session_date')->get()
            ->map(fn ($x) => $x->toArray() + ['error_load' => $analytics->errorLoad($x), 'error_density' => $analytics->errorDensity($x)]);
        return response()->json($rows);
    }

    // FR12
    public function badges(Request $r, int $id)
    {
        $s = $this->studentFor($r, $id);
        return response()->json(['earned' => $s->badges()->get(), 'all' => \App\Models\Badge::all()]);
    }

    // FR13 — total is SUM(points)
    public function xp(Request $r, int $id, GamificationEngine $g)
    {
        $s = $this->studentFor($r, $id);
        return response()->json(['total' => $g->totalXp($s->student_id), 'ledger' => XpLedger::where('student_id', $s->student_id)->orderByDesc('entry_id')->limit(100)->get()]);
    }

    // UC23
    public function challenges(Request $r, int $id)
    {
        $s = $this->studentFor($r, $id);
        return response()->json(['mine' => $s->challenges()->get(), 'available' => Challenge::whereNotIn('challenge_id', $s->challenges()->pluck('challenge.challenge_id'))->get()]);
    }

    public function joinChallenge(Request $r, int $id, int $challengeId)
    {
        $a = $this->actor($r);
        $s = $this->studentFor($r, $id);
        $c = Challenge::findOrFail($challengeId);
        abort_if($s->challenges()->where('challenge.challenge_id', $c->challenge_id)->exists(), 409, 'Already joined');
        $s->challenges()->attach($c->challenge_id, ['status' => 'ACTIVE', 'progress' => 0, 'started_at' => now()]);
        $this->audit->log($a, 'CREATE', 'student_challenge', $c->challenge_id, ['student_id' => $s->student_id]);
        return response()->json($s->challenges()->get(), 201);
    }

    // UC20 — 30-Juz journey map
    public function journey(Request $r, int $id, AnalyticsEngine $analytics)
    {
        $s = $this->studentFor($r, $id);
        $m = $analytics->metrics($s);
        $tiles = [];
        for ($j = 1; $j <= 30; $j++) {
            $tiles[] = ['juz' => $j, 'status' => $j < $s->current_juz ? 'MASTERED' : ($j == $s->current_juz ? 'IN_PROGRESS' : 'NOT_STARTED'),
                'progress' => $j < $s->current_juz ? 100 : ($j == $s->current_juz ? round($m['pages_in_current_juz'] / 20 * 100) : 0)];
        }
        return response()->json(['current_juz' => $s->current_juz, 'tiles' => $tiles]);
    }

    // FR15
    public function reportPdf(Request $r, int $id, ReportService $reports)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER']);
        $s = $this->studentFor($r, $id);
        $path = $reports->studentPdf($s, $r->query('locale', 'en'));
        return response()->file($path, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="student_'.$id.'.pdf"']);
    }

    public function report(Request $r, int $id, ReportService $reports)
    {
        return response()->json($reports->studentReport($this->studentFor($r, $id)));
    }
}
