<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\StaffUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/** FR20 — Circle Administrator manages teachers within their circle. */
class StaffController extends Controller
{
    public function index(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        $q = StaffUser::with('role', 'circle');
        if ($scope = $this->rbac->scopeCircleId($a)) $q->where('circle_id', $scope);
        return response()->json($q->orderBy('name')->get()->map(fn ($u) => $u->toPublic() + ['circle_name' => $u->circle?->name])->values());
    }

    public function storeTeacher(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        $d = $r->validate(['name' => 'required|string|max:120', 'email' => 'required|email|max:160|unique:staff_user,email', 'password' => 'required|string|min:6', 'circle_id' => 'required|integer|exists:circle,circle_id', 'locale' => 'nullable|in:ar,en']);
        $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        $u = StaffUser::create(['name' => $d['name'], 'email' => strtolower($d['email']), 'password_hash' => Hash::make($d['password']),
            'role_id' => Role::where('code', 'TEACHER')->value('role_id'), 'circle_id' => $d['circle_id'], 'locale' => $d['locale'] ?? 'ar']);
        $this->audit->log($a, 'CREATE', 'staff_user', $u->user_id, ['role' => 'TEACHER', 'circle_id' => $d['circle_id']]);
        return response()->json($u->load('role')->toPublic(), 201);
    }

    /** Suspend / reactivate / reassign a teacher (or circle admin, for Sys Admin). */
    public function update(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        $u = StaffUser::with('role')->findOrFail($id);
        abort_if($u->roleCode() === 'SYS_ADMIN', 403, 'System administrators cannot be modified here');
        $this->rbac->requireCircleAccess($a, (int) $u->circle_id);
        $d = $r->validate(['is_active' => 'sometimes|boolean', 'circle_id' => 'sometimes|integer|exists:circle,circle_id', 'name' => 'sometimes|string|max:120', 'locale' => 'sometimes|in:ar,en']);
        if (isset($d['circle_id'])) $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        $u->update($d);
        $this->audit->log($a, 'UPDATE', 'staff_user', $u->user_id, $d);
        return response()->json($u->toPublic());
    }
}
