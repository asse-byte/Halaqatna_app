<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Badge extends Model
{
    protected $table = 'badge';
    protected $primaryKey = 'badge_id';
    public $timestamps = false;
    protected $guarded = [];
}
