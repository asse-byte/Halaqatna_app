<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cache store backing the login rate limiter (NFR3a, §5.1).
 *
 * `CACHE_STORE=database` in both api/.env.example and api/.env.docker, and Laravel's
 * RateLimiter is cache-backed — so without these tables the FIRST call to
 * POST /api/auth/login or /api/auth/student-login fails with "no such table: cache"
 * and both authentication paths (FR1, FR2) are dead on a fresh deployment.
 *
 * The database driver is the deliberate choice over `file`: §5.1 lockouts must be shared
 * across every API worker, and a file cache is per-container. Two attackers hitting two
 * containers would otherwise each get their own five attempts.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cache', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->mediumText('value');
            $t->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->string('owner');
            $t->integer('expiration');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cache');
        Schema::dropIfExists('cache_locks');
    }
};
