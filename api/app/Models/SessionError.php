<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionError extends Model
{
    protected $table = 'session_error';
    protected $primaryKey = 'error_id';
    public $timestamps = false;
    protected $guarded = [];

    public function errorType() { return $this->belongsTo(ErrorType::class, 'error_type_id'); }
}
