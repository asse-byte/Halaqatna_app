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

    /**
     * A register row carries a status only; a recitation also carries pages, a passage or
     * notes. Uses a loaded `errors_count` when the query asked for one (withCount).
     */
    public function hasRecitation(): bool
    {
        return (float) $this->pages_memorized > 0
            || $this->surah_from !== null
            || ($this->errors_count ?? $this->errors()->count()) > 0;
    }

    /** Present, or a legacy "late" row — both count as attended everywhere (consistency, XP, badges). */
    public function attended(): bool
    {
        return in_array($this->attendance_status, ['P', 'L'], true);
    }
}
