<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Circle extends Model
{
    protected $table = 'circle';
    protected $primaryKey = 'circle_id';
    public $timestamps = false;
    protected $guarded = [];

    public function students() { return $this->hasMany(Student::class, 'circle_id'); }
    public function staff() { return $this->hasMany(StaffUser::class, 'circle_id'); }
}
