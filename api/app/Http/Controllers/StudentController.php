<?php

namespace App\Http\Controllers;

use App\Models\Badge;
use App\Models\Challenge;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\SystemSetting;
use App\Models\XpLedger;
use App\Services\AnalyticsEngine;
use App\Services\GamificationEngine;
use App\Services\MlClient;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** UC5 roster, UC12/UC19–UC23 student reads. Access decisions are delegated to AuthRbacService. */
class StudentController extends Controller
{
    private function studentFor(Request $r, int $id): Student
    {
        $s = Student::findOrFail($id);
        $this->rbac->requireStudentAccess($this->actor($r), $s);
        return $s;
    }

    /**
     * Staff list: a Teacher sees only the students assigned to them, a Circle Supervisor
     * sees the whole circle. A System Administrator reaches neither (Table 1.1).
     */
    public function index(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN', 'TEACHER']);
        if ($a['role'] === 'TEACHER') {
            return response()->json($a['model']->students()->with('circle:circle_id,name')->orderBy('name')->get());
        }
        return response()->json(Student::with('circle:circle_id,name', 'teachers:user_id,name')
            ->where('circle_id', $a['circle_id'])->orderBy('name')->get());
    }

    public function show(Request $r, int $id)
    {
        $s = $this->studentFor($r, $id);

        // rotation_due_at is derived, not stored: it is what the screen shows instead of
        // inviting a fresh access code on every visit (FR3).
        return response()->json($s->load('circle', 'teachers:user_id,name')->toArray()
            + ['rotation_due_at' => $s->codeRotationDue()]);
    }

    /**
     * Full profile captured at registration, shared by store() and update().
     *
     * `nullable` is reserved for the columns that really are nullable. `current_juz` and
     * `locale` are NOT NULL with a default, so they take `sometimes`: an absent key is
     * skipped and the default stands, while an explicit null is rejected with a 422 rather
     * than reaching the database and failing there as a 500.
     */
    private const PROFILE_RULES = [
        'guardian_phone' => self::PHONE_RULE,
        'address' => 'nullable|string|max:200',
        'age' => 'nullable|integer|min:3|max:99',
        'current_juz' => 'sometimes|integer|min:1|max:30',
        'locale' => 'sometimes|in:ar,en',
    ];

    /**
     * FR20 — the Circle Supervisor enrols a student. A Teacher cannot: Table 1.1 puts the
     * student roster with the Supervisor, and a teacher who is also the circle's supervisor
     * simply signs in with that role and still can.
     */
    public function store(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN']);
        $d = $r->validate(self::PROFILE_RULES + ['name' => 'required|string|max:120', 'circle_id' => 'required|integer|exists:circle,circle_id',
            'teacher_ids' => 'nullable|array', 'teacher_ids.*' => 'integer|exists:staff_user,user_id']);
        $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        $teacherIds = $d['teacher_ids'] ?? [];
        $s = DB::transaction(function () use ($d, $a, $teacherIds) {
            // array_merge, not `+`: the union operator keeps the LEFT value, so a field sent as
            // null would shadow the default written here rather than being replaced by it.
            $s = Student::create(array_merge(collect($d)->except('teacher_ids')->all(), [
                'current_juz' => $d['current_juz'] ?? 1, 'locale' => $d['locale'] ?? 'ar',
                'access_code' => $this->rbac->generateAccessCode(), 'access_code_issued_at' => now(),
            ]));
            $this->assignTeachers($s, $teacherIds);
            $this->audit->log($a, 'CREATE', 'student', $s->student_id, ['circle_id' => $s->circle_id, 'teacher_ids' => $teacherIds]);

            return $s;
        });
        return response()->json($s->load('teachers:user_id,name'), 201);
    }

    // FR20 — edit the profile, suspend, reassign
    public function update(Request $r, int $id)
    {
        $a = $this->actor($r);
        $s = Student::findOrFail($id);
        $this->rbac->requireStudentManagement($a, $s);
        $d = $r->validate(self::PROFILE_RULES + ['name' => 'sometimes|string|max:120', 'is_active' => 'sometimes|boolean',
            'circle_id' => 'sometimes|integer|exists:circle,circle_id', 'teacher_ids' => 'sometimes|array', 'teacher_ids.*' => 'integer|exists:staff_user,user_id']);
        // Enrolment, suspension and assignment are the Supervisor's (FR20); an assigned teacher
        // may keep the profile itself current — guardian number, age, current Juz.
        if (array_key_exists('circle_id', $d) || array_key_exists('is_active', $d) || array_key_exists('teacher_ids', $d)) {
            $this->rbac->requireRole($a, ['CIRCLE_ADMIN']);
        }
        if (isset($d['circle_id'])) $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        DB::transaction(function () use ($a, $s, $d) {
            if (array_key_exists('teacher_ids', $d)) {
                $this->assignTeachers($s, $d['teacher_ids'], true);
            }
            $s->update(collect($d)->except('teacher_ids')->all());
            $this->audit->log($a, 'UPDATE', 'student', $s->student_id, $d);
        });
        return response()->json($s->load('teachers:user_id,name'));
    }

    /**
     * FR20 — remove a student enrolled by mistake. Only the Circle Supervisor, and only
     * while the record carries nothing worth keeping: once sessions exist the record is
     * evidence behind every metric and forecast, so it is suspended instead of deleted.
     * The audit row survives the delete (FR18) because audit_log holds no foreign key to
     * student and is append-only.
     */
    public function destroy(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN']);
        $s = Student::findOrFail($id);
        $this->rbac->requireStudentManagement($a, $s);
        abort_if($s->sessions()->exists(), 409, 'This student has recorded sessions. Suspend the student instead of deleting the record.');
        DB::transaction(function () use ($a, $s) {
            $s->delete(); // student_teacher, share links and badges cascade (Table 4.1)
            $this->audit->log($a, 'DELETE', 'student', $s->student_id, ['name' => $s->name, 'circle_id' => $s->circle_id]);
        });
        return response()->json(['deleted' => true]);
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

    /**
     * FR10 / UC13 — the stored forecast, or a fresh one with ?refresh=1.
     *
     * `stale` means the forecast may not reflect the latest sessions because the service
     * could not be reached the last time it should have updated it — not that this request
     * happened not to ask for a new one.
     */
    /**
     * FR10 assumptions: the baseline paces a teacher can assume, each a provisional constant
     * in system_setting (rule 8). The second value is only the fallback for a database
     * seeded before the setting existed.
     */
    private const PACE_SETTINGS = ['new' => ['pace_new', 1.0], 'review' => ['pace_review', 5.0], 'fast' => ['pace_fast', 10.0]];

    public function prediction(Request $r, int $id, MlClient $ml, AnalyticsEngine $analytics)
    {
        $s = $this->studentFor($r, $id);
        $d = $r->validate([
            'scope_from' => 'required_with:scope_to|integer|between:1,30',
            'scope_to' => 'required_with:scope_from|integer|between:1,30|gte:scope_from',
            'pace' => 'sometimes|in:recorded,'.implode(',', array_keys(self::PACE_SETTINGS)),
        ]);
        $m = $analytics->metrics($s);
        $fresh = $r->boolean('refresh') ? $ml->forecast($s, $m) : null;
        $p = $fresh ?? $ml->latest($s);
        $mlAvailable = !$ml->isStale($s);
        $paces = array_map(fn ($x) => SystemSetting::num($x[0], $x[1]), self::PACE_SETTINGS);

        return response()->json([
            'prediction' => $p,
            'stale' => $p === null || !$mlAvailable,
            'generated_at' => $p?->generated_at,
            'ml_available' => $mlAvailable,
            // What the assumptions panel needs to explain itself: how much history the
            // forecast rests on, and what each baseline pace stands for.
            'assumptions' => [
                'sessions_count' => $m['sessions_count'],
                'min_sessions' => (int) SystemSetting::num('forecast_min_sessions', 4),
                'recorded_pace' => $m['momentum'],
                'paces' => $paces,
                'current_juz' => $s->current_juz,
            ],
            'scenario' => isset($d['scope_from']) || isset($d['pace']) ? $this->scenario($s, $m, $d, $paces, $ml, $analytics) : null,
        ]);
    }

    /**
     * FR10 assumptions — "when would this student finish Juz 8 to 10 at five pages a week?"
     *
     * The scope and the pace are request parameters, never stored: nothing here writes a
     * prediction row, a setting or a metric (rule 3), so trying an assumption cannot change
     * the student's forecast or anyone's figures. The question still goes to the ML service
     * (rule 6). When the service cannot be reached, the answer falls back to the naïve
     * baseline of the NFR10 protocol — remaining pages ÷ pages per week — and says so in
     * `source`, so an estimate is never shown as the model's forecast.
     */
    private function scenario(Student $s, array $m, array $d, array $paces, MlClient $ml, AnalyticsEngine $analytics): array
    {
        $from = (int) ($d['scope_from'] ?? $s->current_juz);
        $to = (int) ($d['scope_to'] ?? $s->current_juz);
        $pace = $d['pace'] ?? 'recorded';
        $ppw = $pace === 'recorded' ? (float) $m['momentum'] : $paces[$pace];
        $remaining = $analytics->remainingPages($s, $m, $from, $to);

        $forecast = $ml->scenario($s, ['momentum' => $ppw] + $m, $remaining);
        $source = $forecast ? 'model' : 'estimate';
        if (!$forecast) {
            $eta = $remaining <= 0 ? 0 : ($ppw > 0 ? (int) round($remaining / $ppw * 7) : null);
            $forecast = ['eta_days' => $eta, 'predicted_completion_date' => $eta === null ? null : now()->addDays($eta)->toDateString()];
        }

        return ['scope_from' => $from, 'scope_to' => $to, 'pace' => $pace, 'pages_per_week' => $ppw,
            'remaining_pages' => $remaining, 'source' => $source] + $forecast;
    }

    /**
     * Session history. Alongside the stored columns each row carries the two plain numbers
     * the history table shows — how many mistakes were counted, and how accurate the
     * recitation was as a percentage. The weighted load E(s) stays in the payload because
     * the Analytics Engine and the report are built on it, but no screen prints it.
     */
    public function sessions(Request $r, int $id, AnalyticsEngine $analytics)
    {
        $s = $this->studentFor($r, $id);
        $rows = $s->sessions()->with('errors.errorType', 'teacher:user_id,name')->orderByDesc('session_date')->get()
            ->map(fn ($x) => $x->toArray() + [
                'error_load' => $analytics->errorLoad($x),
                'error_density' => $analytics->errorDensity($x),
                'error_count' => $x->errors->count(),
                'accuracy' => $analytics->sessionAccuracy($x),
            ]);
        return response()->json($rows);
    }

    // FR12
    public function badges(Request $r, int $id)
    {
        $s = $this->studentFor($r, $id);
        return response()->json(['earned' => $s->badges()->get(), 'all' => Badge::all()]);
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
        $s = $this->studentFor($r, $id);
        $c = Challenge::findOrFail($challengeId);
        abort_if($s->challenges()->where('challenge.challenge_id', $c->challenge_id)->exists(), 409, 'Already joined');
        $s->challenges()->attach($c->challenge_id, ['status' => 'ACTIVE', 'progress' => 0, 'started_at' => now()]);
        $this->audit->log($this->actor($r), 'CREATE', 'student_challenge', $c->challenge_id, ['student_id' => $s->student_id]);
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
                'progress' => $j < $s->current_juz ? 100 : ($j == $s->current_juz ? round($m['pages_in_current_juz'] / AnalyticsEngine::PAGES_PER_JUZ * 100) : 0)];
        }
        return response()->json(['current_juz' => $s->current_juz, 'tiles' => $tiles]);
    }

    // FR15
    public function reportPdf(Request $r, int $id, ReportService $reports)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN', 'TEACHER']);
        $s = $this->studentFor($r, $id);
        $locale = in_array($r->query('locale'), ['ar', 'en'], true) ? $r->query('locale') : 'ar';
        $pdf = $reports->studentPdf($s, $locale);
        $this->audit->log($a, 'VIEW', 'student_report', $s->student_id, ['format' => 'pdf', 'locale' => $locale]);
        return response($pdf, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="student_'.$id.'.pdf"']);
    }

    public function report(Request $r, int $id, ReportService $reports)
    {
        return response()->json($reports->studentReport($this->studentFor($r, $id)));
    }
}
