<?php

namespace App\Http\Controllers;

use App\Models\Circle;
use App\Models\Role;
use App\Models\StaffUser;
use App\Models\SystemSetting;
use App\Services\GamificationEngine;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/** FR19 (System Admin: circles, circle admins, settings) + FR11/FR14 circle-level reads. */
class CircleController extends Controller
{
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
        $this->rbac->requireRole($a, ['SYS_ADMIN']);
        $d = $r->validate(['name' => 'required|string|max:120', 'location' => 'nullable|string|max:160', 'schedule_time' => 'nullable|date_format:H:i']);
        $c = Circle::create($d);
        $this->audit->log($a, 'CREATE', 'circle', $c->circle_id, $d);
        return response()->json($c, 201);
    }

    public function update(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN']);
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
        return response()->json([
            'circle' => $circle,
            'teachers' => $circle->staff()->with('role')->get()->filter(fn ($u) => $u->roleCode() === 'TEACHER')->map->toPublic()->values(),
            'admins' => $circle->staff()->with('role')->get()->filter(fn ($u) => $u->roleCode() === 'CIRCLE_ADMIN')->map->toPublic()->values(),
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
        $path = $reports->circlePdf(Circle::findOrFail($id), $locale);
        $this->audit->log($a, 'VIEW', 'circle_report', $id, ['format' => 'pdf', 'locale' => $locale]);
        return response()->file($path, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'inline; filename="circle_'.$id.'.pdf"']);
    }

    /**
     * FR19 — remove a circle created by mistake. Refused while anything is enrolled in it:
     * circle_id is RESTRICT from both student and staff_user (Table 4.1), so a populated
     * circle cannot be dropped without taking its people with it.
     */
    public function destroy(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN']);
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
        $this->rbac->requireRole($a, ['SYS_ADMIN']);
        $d = $r->validate(['name' => 'required|string|max:120', 'email' => 'required|email|max:160|unique:staff_user,email',
            'password' => 'required|string|min:6', 'circle_id' => 'required|integer|exists:circle,circle_id',
            // `locale` is NOT NULL with a default, so `sometimes` — not `nullable`, which
            // would let an explicit null through to the column.
            'phone' => 'nullable|string|max:24|regex:/^[0-9+\s()-]{6,24}$/', 'address' => 'nullable|string|max:200', 'locale' => 'sometimes|in:ar,en']);
        // array_merge, not `+`: with the union operator the left operand wins, so the raw
        // email would shadow the lower-cased one and sign-in would stop being case-insensitive.
        $u = StaffUser::create(array_merge(collect($d)->except('password')->all(), [
            'email' => strtolower($d['email']), 'password_hash' => Hash::make($d['password']),
            'role_id' => Role::where('code', 'CIRCLE_ADMIN')->value('role_id'), 'locale' => $d['locale'] ?? 'ar',
        ]));
        $this->audit->log($a, 'CREATE', 'staff_user', $u->user_id, ['role' => 'CIRCLE_ADMIN', 'circle_id' => $d['circle_id']]);
        return response()->json($u->load('role')->toPublic(), 201);
    }

    // FR19 — settings (provisional constants for calibration)
    public function settings(Request $r)
    {
        $this->rbac->requireRole($this->actor($r), ['SYS_ADMIN']);
        return response()->json(SystemSetting::all());
    }

    /** NFR10 — held-out evaluation run by the ML service (linear regression vs alternatives). Sys Admin only. */
    public function forecastEvaluation(Request $r)
    {
        $this->rbac->requireRole($this->actor($r), ['SYS_ADMIN']);
        try {
            $resp = \Illuminate\Support\Facades\Http::timeout(60)->post(rtrim(env('ML_SERVICE_URL'), '/').'/evaluate', ['test_share' => (float) $r->input('test_share', 0.30)]);
            return response()->json($resp->json(), $resp->status());
        } catch (\Throwable $e) {
            return response()->json(['message' => 'ML service unavailable'], 503);
        }
    }

    public function updateSettings(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN']);
        $d = $r->validate(['settings' => 'required|array', 'settings.*' => 'required|numeric']);
        foreach ($d['settings'] as $k => $v) {
            SystemSetting::where('setting_key', $k)->update(['setting_value' => (string) $v]);
        }
        $this->audit->log($a, 'UPDATE', 'system_setting', null, $d['settings']);
        return response()->json(SystemSetting::all());
    }
}
