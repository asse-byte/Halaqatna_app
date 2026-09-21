<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\StaffUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Staff records, split along the boundary of Table 1.1.
 *
 * A System Administrator sees and manages Circle Supervisors, because FR19 makes assigning
 * them its job. A Circle Supervisor sees and manages the teachers of their own circle
 * (FR20). Neither crosses into the other's list.
 */
class StaffController extends Controller
{
    private const PROFILE_RULES = [
        'phone' => 'nullable|string|max:24|regex:/^[0-9+\s()-]{6,24}$/',
        'address' => 'nullable|string|max:200',
        'locale' => 'nullable|in:ar,en',
    ];

    public function index(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        $q = StaffUser::with('role', 'circle');
        if ($a['role'] === 'SYS_ADMIN') {
            $q->where('role_id', Role::where('code', 'CIRCLE_ADMIN')->value('role_id'));
        } else {
            $q->where('circle_id', $a['circle_id'])
                ->where('role_id', Role::where('code', 'TEACHER')->value('role_id'));
        }

        return response()->json($q->orderBy('name')->get()->map(fn ($u) => $u->toPublic() + ['circle_name' => $u->circle?->name])->values());
    }

    /** FR20 — the Circle Supervisor registers a teacher with their full contact details. */
    public function storeTeacher(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['CIRCLE_ADMIN']);
        $d = $r->validate(self::PROFILE_RULES + [
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:160|unique:staff_user,email',
            'password' => 'required|string|min:6',
            'circle_id' => 'required|integer|exists:circle,circle_id',
        ]);
        $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        // array_merge, not `+`: the union operator keeps the LEFT value on a key clash, which
        // would let the raw email shadow the lower-cased one written here.
        $u = StaffUser::create(array_merge(collect($d)->except('password')->all(), [
            'email' => strtolower($d['email']),
            'password_hash' => Hash::make($d['password']),
            'role_id' => Role::where('code', 'TEACHER')->value('role_id'),
            'locale' => $d['locale'] ?? 'ar',
        ]));
        $this->audit->log($a, 'CREATE', 'staff_user', $u->user_id, ['role' => 'TEACHER', 'circle_id' => $d['circle_id']]);

        return response()->json($u->load('role')->toPublic(), 201);
    }

    /**
     * Edit, suspend, reactivate or reassign. A Circle Supervisor may only touch teachers of
     * their own circle; a System Administrator may only touch Circle Supervisors.
     */
    public function update(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        $u = StaffUser::with('role')->findOrFail($id);
        $this->requireManagementOf($a, $u);

        $d = $r->validate(self::PROFILE_RULES + [
            'is_active' => 'sometimes|boolean',
            'name' => 'sometimes|string|max:120',
            'email' => 'sometimes|email|max:160|unique:staff_user,email,'.$u->user_id.',user_id',
            'password' => 'sometimes|string|min:6',
            'circle_id' => 'sometimes|integer|exists:circle,circle_id',
        ]);
        if (isset($d['circle_id']) && $a['role'] !== 'SYS_ADMIN') $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        if (isset($d['email'])) $d['email'] = strtolower($d['email']);
        if (isset($d['password'])) {
            $u->password_hash = Hash::make($d['password']);
            unset($d['password']);
        }
        $u->fill($d)->save();
        // The password itself is never written to the audit payload — only that it changed.
        $this->audit->log($a, 'UPDATE', 'staff_user', $u->user_id, $d + ($r->filled('password') ? ['password' => 'reset'] : []));

        return response()->json($u->toPublic());
    }

    /**
     * Remove a staff record created by mistake. Refused once the teacher has recorded
     * sessions: session.user_id is RESTRICT in Table 4.1 precisely so that the author of a
     * record cannot vanish from it. Suspension is the route for someone who has taught.
     */
    public function destroy(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        $u = StaffUser::with('role')->findOrFail($id);
        $this->requireManagementOf($a, $u);
        abort_if(\App\Models\RecitationSession::where('user_id', $u->user_id)->exists(), 409, 'This teacher has recorded sessions. Suspend the account instead of deleting it.');

        $name = $u->name;
        $u->students()->detach();
        $u->delete();
        $this->audit->log($a, 'DELETE', 'staff_user', $id, ['name' => $name, 'role' => $u->roleCode()]);

        return response()->json(['deleted' => true]);
    }

    private function requireManagementOf(array $actor, StaffUser $target): void
    {
        abort_if($target->roleCode() === 'SYS_ADMIN', 403, 'System administrators cannot be modified here');
        if ($actor['role'] === 'SYS_ADMIN') {
            abort_if($target->roleCode() !== 'CIRCLE_ADMIN', 403, 'A System Administrator manages circle supervisors only');

            return;
        }
        abort_if($target->roleCode() !== 'TEACHER', 403, 'A Circle Supervisor manages teachers only');
        $this->rbac->requireCircleAccess($actor, (int) $target->circle_id);
    }
}
