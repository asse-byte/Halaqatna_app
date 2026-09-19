<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// APPEND ONLY — the DB user has no UPDATE/DELETE grant on this table.
class AuditLog extends Model
{
    protected $table = 'audit_log';
    protected $primaryKey = 'log_id';
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = ['payload_json' => 'array'];

    public function actor() { return $this->belongsTo(StaffUser::class, 'actor_user_id'); }
}
