<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffUser extends Model
{
    protected $table = 'staff_user';
    protected $primaryKey = 'user_id';
    public $timestamps = false;
    protected $guarded = [];
    protected $hidden = ['password_hash'];
    protected $casts = ['is_active' => 'boolean'];

    /**
     * §2.3 constraint — `circle_id` MUST be NULL when the role is SYS_ADMIN.
     *
     * MySQL cannot express this as a CHECK, because the role code lives in another table.
     * It is enforced here instead: §6 makes the Eloquent DAL the single path to the database,
     * so every writer — controllers, seeders and tinker alike — passes through this hook.
     * A System Administrator is deliberately circle-less: `AuthRbacService::requireCircleAccess`
     * lets that role reach any circle, so a stored `circle_id` would be both meaningless and
     * misleading about the scope the token actually carries.
     */
    protected static function booted(): void
    {
        static::saving(function (self $user) {
            if ($user->circle_id === null) {
                return;
            }
            $code = Role::whereKey($user->role_id)->value('code');
            if ($code === 'SYS_ADMIN') {
                throw new \LogicException('§2.3: a SYS_ADMIN staff_user must have circle_id = NULL.');
            }
        });
    }

    public function role() { return $this->belongsTo(Role::class, 'role_id'); }
    public function circle() { return $this->belongsTo(Circle::class, 'circle_id'); }
    public function students() { return $this->belongsToMany(Student::class, 'student_teacher', 'user_id', 'student_id'); }

    public function roleCode(): string { return $this->role->code; }

    public function toPublic(): array
    {
        return [
            'user_id' => $this->user_id, 'name' => $this->name, 'email' => $this->email,
            'role' => $this->roleCode(), 'circle_id' => $this->circle_id, 'locale' => $this->locale,
            'is_active' => $this->is_active,
        ];
    }
}
