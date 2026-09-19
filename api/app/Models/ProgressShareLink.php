<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * §2.13 progress_share_link — FR21. The token is the only credential; it is never derived
 * from student_id and never sequential. Expiry and revocation both make the card a 404.
 */
class ProgressShareLink extends Model
{
    protected $table = 'progress_share_link';
    protected $primaryKey = 'link_id';
    public $timestamps = false;
    protected $guarded = [];
    protected $hidden = ['token'];
    protected $casts = ['view_count' => 'integer'];

    public function student() { return $this->belongsTo(Student::class, 'student_id'); }

    public function createdBy() { return $this->belongsTo(StaffUser::class, 'created_by_user_id'); }

    public function isActive(): bool
    {
        return $this->revoked_at === null && now()->lt($this->expires_at);
    }
}
