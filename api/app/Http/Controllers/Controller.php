<?php

namespace App\Http\Controllers;

use App\Services\AuditLogger;
use App\Services\AuthRbacService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

abstract class Controller extends BaseController
{
    public function __construct(protected AuthRbacService $rbac, protected AuditLogger $audit) {}

    protected function actor(Request $r): array
    {
        return $r->attributes->get('actor');
    }
}
