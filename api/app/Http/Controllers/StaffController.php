<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\ProgressShareLink;
use App\Models\RecitationSession;
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
    /**
     * `phone` and `address` really are nullable columns, so they take `nullable`.
     * `locale` is NOT NULL with a default, so it takes `sometimes`: an absent key leaves the
     * stored value alone, and an explicit null is a 422 instead of a database error.
     */
    private const PROFILE_RULES = [
        'phone' => self::PHONE_RULE,
        'address' => 'nullable|string|max:200',
        'locale' => 'sometimes|in:ar,en',
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
        $this->lowercaseEmail($r);
        $d = $r->validate(self::PROFILE_RULES + [
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:160|unique:staff_user,email',
            'password' => 'required|'.self::PASSWORD_RULE,
            'circle_id' => 'required|integer|exists:circle,circle_id',
        ]);
        $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        // array_merge, not `+`: the union operator keeps the LEFT value on a key clash, so
        // an explicit null locale would shadow the default written here.
        $u = StaffUser::create(array_merge(collect($d)->except('password')->all(), [
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

        $this->lowercaseEmail($r);
        $d = $r->validate(self::PROFILE_RULES + [
            'is_active' => 'sometimes|boolean',
            'name' => 'sometimes|string|max:120',
            'email' => 'sometimes|email|max:160|unique:staff_user,email,'.$u->user_id.',user_id',
            'password' => 'sometimes|'.self::PASSWORD_RULE,
            'circle_id' => 'sometimes|integer|exists:circle,circle_id',
        ]);
        if (isset($d['circle_id']) && $a['role'] !== 'SYS_ADMIN') $this->rbac->requireCircleAccess($a, (int) $d['circle_id']);
        $passwordReset = isset($d['password']);
        if ($passwordReset) {
            // A reset also signs the account out everywhere: its tokens carry the old hash's fingerprint.
            $u->password_hash = Hash::make($d['password']);
            unset($d['password']);
        }
        $u->fill($d)->save();
        // The password itself is never written to the audit payload — only that it changed.
        $this->audit->log($a, 'UPDATE', 'staff_user', $u->user_id, $d + ($passwordReset ? ['password' => 'reset'] : []));

        return response()->json($u->toPublic());
    }

    /**
     * Remove a staff record created by mistake. Refused once the account has left a trace:
     * session.user_id, progress_share_link.created_by_user_id and audit_log.actor_user_id
     * are all RESTRICT (Table 4.1) precisely so that the author of a record cannot vanish
     * from it. Suspension is the route for someone who has worked in the system.
     */
    public function destroy(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN']);
        $u = StaffUser::with('role')->findOrFail($id);
        $this->requireManagementOf($a, $u);
        $hasHistory = RecitationSession::where('user_id', $u->user_id)->exists()
            || ProgressShareLink::where('created_by_user_id', $u->user_id)->exists()
            || AuditLog::where('actor_user_id', $u->user_id)->exists();
        abort_if($hasHistory, 409, 'This account already has recorded activity. Suspend it instead of deleting it.');

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
