<?php

use App\Http\Middleware\JwtAuthenticate;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // Root-level, stateless routes — the public progress card lives here (FR21 / UC26).
        then: function () {
            Route::group([], base_path('routes/web.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Only authentication is middleware. Every AUTHORIZATION decision is made by the
        // Auth & RBAC Service, called explicitly from the controller that needs it (rule 5)
        // — most checks depend on the resource (this circle, this student), which a route
        // alias cannot express, so there is deliberately no `role:` middleware.
        $middleware->alias([
            'auth.jwt' => JwtAuthenticate::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Everything is a JSON API except the public progress card, which is an HTML page
        // and must render an ordinary 404 page when its token is unknown/expired/revoked.
        $exceptions->shouldRenderJsonWhen(fn (Request $r, Throwable $e) => !$r->is('p/*'));
        $exceptions->render(function (Throwable $e, Request $r) {
            // The public progress card is an HTML page: let Laravel render its ordinary
            // error page for a dead token rather than a JSON body (FR21 / UC26).
            if ($r->is('p/*')) {
                return null;
            }
            if ($e instanceof ValidationException) {
                return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
            }
            // findOrFail() on an unknown id. Laravel's own message names the model class
            // ("No query results for model [App\Models\Student] 7"), which is internal detail.
            if ($e->getPrevious() instanceof ModelNotFoundException) {
                return response()->json(['message' => 'Not found'], 404);
            }
            if ($e instanceof HttpExceptionInterface) {
                // Keep the exception's own headers — a 429 carries Retry-After (NFR3a, §5.1).
                return response()->json(['message' => $e->getMessage() ?: 'Error'], $e->getStatusCode(), $e->getHeaders());
            }
            // Driver-independent: MySQL says "Duplicate entry" / "a foreign key constraint
            // fails", SQLite says "UNIQUE constraint failed" / "FOREIGN KEY constraint failed".
            if ($e instanceof UniqueConstraintViolationException) {
                return response()->json(['message' => 'Duplicate entry — this record already exists'], 409);
            }
            if ($e instanceof QueryException && stripos($e->getMessage(), 'foreign key constraint') !== false) {
                return response()->json(['message' => 'Operation refused — record is still referenced'], 409);
            }
            return null;
        });
    })->create();
