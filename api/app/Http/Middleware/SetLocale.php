<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;

/**
 * Answers each request in the language its client is showing (NFR6). The web and mobile
 * clients send Accept-Language with the interface locale, so a refusal or a validation
 * message reaches an Arabic screen in Arabic. A request without the header gets English.
 */
class SetLocale
{
    public function handle(Request $request, Closure $next)
    {
        App::setLocale($request->getPreferredLanguage(['en', 'ar']) ?? 'en');
        return $next($request);
    }
}
