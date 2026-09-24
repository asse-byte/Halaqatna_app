<?php

namespace App\Http\Controllers;

use App\Models\Circle;
use App\Models\Role;
use App\Models\StaffUser;
use App\Models\SystemSetting;
use App\Services\GamificationEngine;
use App\Services\MlClient;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/** FR19 (System Admin: circles, circle admins, settings) + FR11/FR14 circle-level reads. */
class CircleController extends Controller
{
    /**
     * The provisional constants (UC3) and the range each one can take. A value outside it is
     * not a calibration but a breakage: d_max = 0 divides by zero in every Mastery figure,
     * alpha outside (0, 1] is no longer a weighted average, and negative XP rates would
     * take points away from students for attending.
     */
    public const SETTING_RULES = [
        'd_max' => 'numeric|gt:0|max:100',
        'alpha' => 'numeric|gt:0|lte:1',
        'xp_per_page' => 'integer|min:0|max:1000',
        'xp_per_session' => 'integer|min:0|max:1000',
    ];

    public function index(Request $r)
    {
        $a = $this->actor($r);
        $q = Circle::withCount(['students', 'staff']);
        if ($scope = $this->rbac->scopeCircleId($a)) $q->where('circle_id', $scope);
        return response()->json($q->orderBy('name')->get());
    }

    public function store(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireDeploymentAdmin($a);
        $d = $r->validate(['name' => 'required|string|max:120', 'location' => 'nullable|string|max:160', 'schedule_time' => 'nullable|date_format:H:i']);
        $c = Circle::create($d);
        $this->audit->log($a, 'CREATE', 'circle', $c->circle_id, $d);
        return response()->json($c, 201);
    }

    public function update(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireDeploymentAdmin($a);
        $c = Circle::findOrFail($id);
        $d = $r->validate(['name' => 'sometimes|string|max:120', 'location' => 'nullable|string|max:160', 'schedule_time' => 'nullable|date_format:H:i']);
        $c->update($d);
        $this->audit->log($a, 'UPDATE', 'circle', $c->circle_id, $d);
        return response()->json($c);
    }

    public function show(Request $r, int $id)
    {
        $a = $this->actor($r);
        // The circle as an administrative object (FR19) is the System Administrator's
        // business; its contents are not. Circle staff reach it through their own scope.
        if ($a['role'] !== 'SYS_ADMIN') $this->rbac->requireCircleAccess($a, $id);
        return response()->json(Circle::withCount(['students', 'staff'])->findOrFail($id));
    }

    // FR20 roster (staff of the circle only — Circle Admin exit test of I1)
    public function roster(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN', 'TEACHER']);
        $this->rbac->requireCircleAccess($a, $id);
        $circle = Circle::findOrFail($id);
        $staff = $circle->staff()->with('role')->orderBy('name')->get();
        $byRole = fn (string $role) => $staff->filter(fn ($u) => $u->roleCode() === $role)->map->toPublic()->values();

        return response()->json([
            'circle' => $circle,
            'teachers' => $byRole('TEACHER'),
            'admins' => $byRole('CIRCLE_ADMIN'),
            'students' => $circle->students()->with('teachers:user_id,name')->orderBy('name')->get(),
        ]);
    }

    // FR11 — four independent rankings; students get aggregate positions only
    public function leaderboard(Request $r, int $id, GamificationEngine $g)
    {
        $a = $this->actor($r);
        $this->rbac->requireCircleAccess($a, $id);
        $criterion = $r->query('criterion', 'momentum');
        abort_unless(in_array($criterion, ['momentum', 'precision', 'consistency', 'review_depth'], true), 422, 'Unknown criterion');
        return response()->json(['criterion' => $criterion, 'circle_id' => $id, 'rows' => $g->leaderboard(Circle::findOrFail($id), $criterion)]);
    }

    // FR14 — term report per circle
    public function report(Request $r, int $id, ReportService $reports)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN']);
        $this->rbac->requireCircleAccess($a, $id);
        return response()->json($reports->circleReport(Circle::findOrFail($id)));
    }

    /** The Supervisor's dashboard: the circle at a glance, plus who needs attention. */
    public function dashboard(Request $r, int $id, ReportService $reports)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN', 'TEACHER']);
        $this->rbac->requireCircleAccess($a, $id);
        $teacherId = $a['role'] === 'TEACHER' ? (int) $a['id'] : null;
        return response()->json($reports->dashboard(Circle::findOrFail($id), $teacherId));
    }

    public function reportPdf(Request $r, int $id, ReportService $reports)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN']);
        $this->rbac->requireCircleAccess($a, $id);
        $locale = in_array($r->query('locale'), ['ar', 'en'], true) ? $r->query('locale') : 'ar';
        $pdf = $reports->circlePdf(Circle::findOrFail($id), $locale);
        $this->audit->log($a, 'VIEW', 'circle_report', $id, ['format' => 'pdf', 'locale' => $locale]);
        return response($pdf, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="circle_'.$id.'.pdf"']);
    }

    /**
     * FR19 — remove a circle created by mistake. Refused while anything is enrolled in it:
     * circle_id is RESTRICT from both student and staff_user (Table 4.1), so a populated
     * circle cannot be dropped without taking its people with it.
     */
    public function destroy(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireDeploymentAdmin($a);
        $c = Circle::withCount(['students', 'staff'])->findOrFail($id);
        abort_if($c->students_count > 0 || $c->staff_count > 0, 409, 'This circle still has a supervisor, teachers or students. Move or remove them first.');
        $c->delete();
        $this->audit->log($a, 'DELETE', 'circle', $id, ['name' => $c->name]);
        return response()->json(['deleted' => true]);
    }

    // FR19 — circle supervisors: the only people the System Administrator deals with
    public function storeCircleAdmin(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireDeploymentAdmin($a);
        $this->lowercaseEmail($r);
        $d = $r->validate(['name' => 'required|string|max:120', 'email' => 'required|email|max:160|unique:staff_user,email',
            'password' => 'required|'.self::PASSWORD_RULE, 'circle_id' => 'required|integer|exists:circle,circle_id',
            // `locale` is NOT NULL with a default, so `sometimes` — not `nullable`, which
            // would let an explicit null through to the column.
            'phone' => self::PHONE_RULE, 'address' => 'nullable|string|max:200', 'locale' => 'sometimes|in:ar,en']);
        // array_merge, not `+`: with the union operator the left operand wins, so an explicit
        // null locale would shadow the default written here.
        $u = StaffUser::create(array_merge(collect($d)->except('password')->all(), [
            'password_hash' => Hash::make($d['password']),
            'role_id' => Role::where('code', 'CIRCLE_ADMIN')->value('role_id'), 'locale' => $d['locale'] ?? 'ar',
        ]));
        $this->audit->log($a, 'CREATE', 'staff_user', $u->user_id, ['role' => 'CIRCLE_ADMIN', 'circle_id' => $d['circle_id']]);
        return response()->json($u->load('role')->toPublic(), 201);
    }

    // FR19 — settings (provisional constants for calibration)
    public function settings(Request $r)
    {
        $this->rbac->requireDeploymentAdmin($this->actor($r));
        return response()->json(SystemSetting::orderBy('setting_key')->get());
    }

    /** NFR10 — held-out evaluation run by the ML service (linear regression vs alternatives). Sys Admin only. */
    public function forecastEvaluation(Request $r, MlClient $ml)
    {
        $this->rbac->requireDeploymentAdmin($this->actor($r));
        $d = $r->validate(['test_share' => 'sometimes|numeric|min:0.1|max:0.5']);
        [$status, $body] = $ml->evaluate((float) ($d['test_share'] ?? 0.30));

        return response()->json($body, $status);
    }

    public function updateSettings(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireDeploymentAdmin($a);
        $r->validate(['settings' => 'required|array']);
        $unknown = array_diff(array_keys($r->input('settings')), array_keys(self::SETTING_RULES));
        if ($unknown) {
            throw ValidationException::withMessages(['settings' => 'Unknown setting: '.implode(', ', $unknown)]);
        }
        $rules = [];
        foreach (self::SETTING_RULES as $key => $rule) {
            $rules["settings.$key"] = 'sometimes|required|'.$rule;
        }
        $d = $r->validate($rules);

        foreach ($d['settings'] ?? [] as $k => $v) {
            SystemSetting::where('setting_key', $k)->update(['setting_value' => (string) $v]);
        }
        $this->audit->log($a, 'UPDATE', 'system_setting', null, $d['settings'] ?? []);
        return response()->json(SystemSetting::orderBy('setting_key')->get());
    }
}
