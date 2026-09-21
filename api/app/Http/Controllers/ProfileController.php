<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Staff self-service: a teacher keeps their own contact details current and changes their
 * own password without waiting for the Circle Supervisor.
 *
 * The edits land on the same staff_user row the Supervisor reads, so the roster and the
 * circle report show the new details on the next load — there is no second copy of a
 * teacher's profile anywhere. Every change writes an audit row (FR18), which is what makes
 * a self-service edit accountable rather than invisible.
 *
 * Deliberately NOT editable here: role, circle and is_active. Those decide what the account
 * can reach, and FR19/FR20 place them with the administrator who granted them.
 */
class ProfileController extends Controller
{
    public function show(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER']);

        return response()->json($a['model']->toPublic() + ['circle_name' => $a['model']->circle?->name]);
    }

    public function update(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER']);
        $u = $a['model'];
        $d = $r->validate([
            'name' => 'sometimes|string|max:120',
            'email' => 'sometimes|email|max:160|unique:staff_user,email,'.$u->user_id.',user_id',
            'phone' => 'nullable|string|max:24|regex:/^[0-9+\s()-]{6,24}$/',
            'address' => 'nullable|string|max:200',
            'locale' => 'sometimes|in:ar,en',
        ]);
        if (isset($d['email'])) $d['email'] = strtolower($d['email']);
        $u->fill($d)->save();
        $this->audit->log($a, 'UPDATE', 'staff_user', $u->user_id, $d + ['event' => 'self_service_profile']);

        return response()->json($u->toPublic());
    }

    /**
     * The current password is required even though the caller already holds a valid token:
     * it is what stops a borrowed unlocked phone from locking the real teacher out of their
     * own account. The new hash is bcrypt, as NFR3 requires.
     */
    public function changePassword(Request $r)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['SYS_ADMIN', 'CIRCLE_ADMIN', 'TEACHER']);
        $d = $r->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);
        $u = $a['model'];
        abort_unless(Hash::check($d['current_password'], $u->password_hash), 422, 'The current password is not correct');
        abort_if(Hash::check($d['new_password'], $u->password_hash), 422, 'The new password must differ from the current one');

        $u->password_hash = Hash::make($d['new_password']);
        $u->save();
        // Only the fact of the change is recorded. Neither password reaches the audit trail.
        $this->audit->log($a, 'UPDATE', 'staff_user', $u->user_id, ['event' => 'self_service_password_change']);

        return response()->json(['changed' => true]);
    }
}
