<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Challenge extends Model
{
    protected $table = 'challenge';
    protected $primaryKey = 'challenge_id';
    public $timestamps = false;
    protected $guarded = [];
}
