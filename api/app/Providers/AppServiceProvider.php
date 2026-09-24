<?php

namespace App\Providers;

use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // See config/halaqtna.php: behind nginx the client IP (rate limiting, NFR3a) and the
        // https scheme (share links, FR21) only reach Laravel through X-Forwarded-* headers.
        $proxies = trim((string) config('halaqtna.trusted_proxies'));
        if ($proxies !== '') {
            TrustProxies::at($proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));
        }
    }
}
