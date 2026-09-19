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

    // FR2
    public function studentLogin(Request $r)
    {
        $d = $r->validate(['access_code' => 'required|string|min:8|max:12']);
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

    // FR3 — teacher regenerates a student access code (old code revoked immediately)
    public function regenerateAccessCode(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER', 'CIRCLE_ADMIN', 'SYS_ADMIN']);
        $student = Student::findOrFail($id);
        $this->rbac->requireStudentManagement($a, $student);
        $student->access_code = $this->rbac->generateAccessCode();
        $student->save();
        $this->audit->log($a, 'UPDATE', 'student', $student->student_id, ['field' => 'access_code', 'event' => 'regenerated']);
        return response()->json(['student_id' => $student->student_id, 'access_code' => $student->access_code]);
    }
}
