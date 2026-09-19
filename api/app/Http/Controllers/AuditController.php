<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

/** FR18 / UC8 — System Admin reviews the append-only trail. */
class AuditController extends Controller
{
    public function index(Request $r)
    {
        $this->rbac->requireRole($this->actor($r), ['SYS_ADMIN']);
        $q = AuditLog::with('actor:user_id,name,email')->orderByDesc('log_id');
        if ($e = $r->query('entity')) $q->where('entity', $e);
        if ($act = $r->query('action')) $q->where('action', $act);
        return response()->json($q->paginate(50));
    }
}
