<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// APPEND ONLY — the DB user has no UPDATE/DELETE grant on this table.
class XpLedger extends Model
{
    protected $table = 'xp_ledger';
    protected $primaryKey = 'entry_id';
    public $timestamps = false;
    protected $guarded = [];
}
