<?php

namespace App\Http\Middleware;

use App\Services\AuthRbacService;
use Closure;
use Illuminate\Http\Request;

class JwtAuthenticate
{
    public function __construct(private AuthRbacService $rbac) {}

    public function handle(Request $request, Closure $next)
    {
        $request->attributes->set('actor', $this->rbac->resolveActor($request));
        return $next($request);
    }
}
