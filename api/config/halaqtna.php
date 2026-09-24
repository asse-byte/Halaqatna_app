<?php

/*
 * Halaqtna's own settings.
 *
 * Everything the application reads from the environment is read here, once, and nowhere
 * else. Calling env() from a service or a controller works until someone runs
 * `php artisan config:cache` — after that env() returns null outside config files, so the
 * JWT secret, the ML address and the trusted proxies would all silently disappear.
 */
return [

    // Auth & RBAC Service (FR1, FR2). The secret signs every token, staff and student alike.
    'jwt' => [
        'secret' => env('JWT_SECRET'),
        'ttl_minutes' => (int) env('JWT_TTL_MINUTES', 720),
    ],

    // ML Prediction Service (FR10) — internal HTTP only, never published.
    'ml' => [
        'url' => rtrim((string) env('ML_SERVICE_URL', 'http://127.0.0.1:8000'), '/'),
        'timeout' => (int) env('ML_TIMEOUT_SECONDS', 3),
        // The held-out evaluation trains three models, so it gets far longer than a forecast.
        'evaluation_timeout' => (int) env('ML_EVALUATION_TIMEOUT_SECONDS', 60),
    ],

    // The seeded System Administrator (FR19). DatabaseSeeder refuses to run without both.
    'sys_admin' => [
        'email' => env('SYS_ADMIN_EMAIL'),
        'password' => env('SYS_ADMIN_PASSWORD'),
    ],

    /*
     * Proxies whose X-Forwarded-* headers are believed (NFR3a, FR21).
     *
     * Behind nginx every request reaches Laravel from the nginx container, so without this
     * the API sees one client IP for the whole deployment — five wrong access codes from
     * anyone would lock out every student — and it builds share links as http:// because
     * nginx talks to it over plain HTTP. `*` trusts whoever connected, which is correct only
     * when the API is unreachable except through the proxy, as it is under Docker Compose.
     * Leave it empty when Laravel is reached directly.
     */
    'trusted_proxies' => env('TRUSTED_PROXIES'),

];
