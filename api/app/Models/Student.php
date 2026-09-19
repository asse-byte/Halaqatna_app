<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $table = 'student';
    protected $primaryKey = 'student_id';
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = ['is_active' => 'boolean', 'current_juz' => 'integer'];

    public function circle() { return $this->belongsTo(Circle::class, 'circle_id'); }
    public function teachers() { return $this->belongsToMany(StaffUser::class, 'student_teacher', 'student_id', 'user_id'); }
    public function sessions() { return $this->hasMany(RecitationSession::class, 'student_id'); }
    public function badges() { return $this->belongsToMany(Badge::class, 'student_badge', 'student_id', 'badge_id')->withPivot('earned_at'); }
    public function challenges() { return $this->belongsToMany(Challenge::class, 'student_challenge', 'student_id', 'challenge_id')->withPivot(['status', 'progress', 'started_at', 'completed_at']); }
}
