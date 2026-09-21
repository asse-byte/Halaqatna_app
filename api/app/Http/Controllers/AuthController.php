<?php

namespace App\Http\Controllers;

use App\Models\Student;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    // FR1
    public function login(Request $r)
    {
        $d = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        return response()->json($this->rbac->staffLogin($d['email'], $d['password'], $r->ip()));
    }

    // FR2 — accepts the short six-character codes and the eight-character ones already issued
    public function studentLogin(Request $r)
    {
        $d = $r->validate(['access_code' => 'required|string|min:6|max:12']);
        return response()->json($this->rbac->studentLogin($d['access_code'], $r->ip()));
    }

    public function me(Request $r)
    {
        $a = $this->actor($r);
        if ($a['type'] === 'staff') {
            return response()->json(['type' => 'staff', 'user' => $a['model']->toPublic()]);
        }
        return response()->json(['type' => 'student', 'student' => $a['model']->load('circle')]);
    }

    /**
     * FR3 — rotate a student access code. The old code stops working immediately.
     *
     * This is now an occasional act, not a per-login one: the code a student holds keeps
     * working until someone chooses to replace it, and the response carries the date the
     * next rotation is due so the screen can say so instead of inviting a fresh code.
     */
    public function regenerateAccessCode(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER', 'CIRCLE_ADMIN']);
        $student = Student::findOrFail($id);
        $this->rbac->requireStudentManagement($a, $student);
        $code = $this->rbac->rotateAccessCode($student);
        $this->audit->log($a, 'UPDATE', 'student', $student->student_id, ['field' => 'access_code', 'event' => 'rotated']);

        return response()->json([
            'student_id' => $student->student_id,
            'access_code' => $code,
            'access_code_issued_at' => $student->access_code_issued_at,
            'rotation_due_at' => $student->codeRotationDue(),
        ]);
    }
}
