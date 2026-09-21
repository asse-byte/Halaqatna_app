<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $table = 'student';
    protected $primaryKey = 'student_id';
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = ['is_active' => 'boolean', 'current_juz' => 'integer', 'age' => 'integer', 'access_code_issued_at' => 'datetime'];

    /** How long one access code stays valid before the teacher is prompted to rotate it. */
    public const CODE_ROTATION_DAYS = 30;

    /**
     * The code never expires by itself — a student locked out mid-term because nobody
     * pressed a button is exactly the problem this replaces. It only reports when the
     * teacher should refresh it, and the teacher can still revoke it at any moment (NFR3).
     */
    public function codeRotationDue(): ?\Carbon\Carbon
    {
        return $this->access_code_issued_at?->copy()->addDays(self::CODE_ROTATION_DAYS);
    }

    public function circle() { return $this->belongsTo(Circle::class, 'circle_id'); }
    public function teachers() { return $this->belongsToMany(StaffUser::class, 'student_teacher', 'student_id', 'user_id'); }
    public function sessions() { return $this->hasMany(RecitationSession::class, 'student_id'); }
    public function badges() { return $this->belongsToMany(Badge::class, 'student_badge', 'student_id', 'badge_id')->withPivot('earned_at'); }
    public function challenges() { return $this->belongsToMany(Challenge::class, 'student_challenge', 'student_id', 'challenge_id')->withPivot(['status', 'progress', 'started_at', 'completed_at']); }
}
