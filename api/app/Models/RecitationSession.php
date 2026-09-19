<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecitationSession extends Model
{
    protected $table = 'session';
    protected $primaryKey = 'session_id';
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = ['pages_memorized' => 'float'];

    public function student() { return $this->belongsTo(Student::class, 'student_id'); }
    public function teacher() { return $this->belongsTo(StaffUser::class, 'user_id'); }
    public function errors() { return $this->hasMany(SessionError::class, 'session_id'); }
}
