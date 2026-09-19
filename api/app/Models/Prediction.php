<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Prediction extends Model
{
    protected $table = 'prediction';
    protected $primaryKey = 'prediction_id';
    public $timestamps = false;
    protected $guarded = [];
}
