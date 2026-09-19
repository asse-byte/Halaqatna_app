<?php

use App\Http\Controllers\ShareController;
use Illuminate\Support\Facades\Route;

/*
 * Root-level routes (no /api prefix, no session or CSRF middleware).
 *
 * FR21 / UC26 — the public progress card. It is served here rather than by the SPA so
 * that the page itself carries <meta name="robots" content="noindex"> and so that an
 * unknown, expired or revoked token is a real 404 rather than an empty SPA shell.
 * The token constraint matches §2.13: 32 random bytes, base64url, 43 characters.
 */
Route::get('/p/{token}', [ShareController::class, 'card'])->where('token', '[A-Za-z0-9_-]{43}');

/*
 * In production nginx serves the React SPA at `/` and proxies only `/api/` and `/p/` to this
 * container, so this route is never reached from outside. It answers locally, where Laravel is
 * hit directly, with a service identifier rather than a landing page — the user interfaces are
 * the React client in /frontend and the React Native teacher client in /mobile (§1).
 */
Route::get('/', fn () => response()->json([
    'service' => 'halaqtna-api',
    'project' => 'Halaqtna — Smart Quran Memorization Circle Management System (CPIT-499)',
    'team' => ['Abdoul Malick Cisse (2250954)', 'Munthir Al-Farsi (2340042)'],
    'supervisor' => 'Dr. Ahmad Tayeb — King Abdulaziz University',
    'health' => url('/api/health'),
]));
