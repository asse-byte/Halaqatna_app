<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErrorType extends Model
{
    protected $table = 'error_type';
    protected $primaryKey = 'error_type_id';
    public $timestamps = false;
    protected $guarded = [];
    protected $casts = ['weight' => 'float'];
}
