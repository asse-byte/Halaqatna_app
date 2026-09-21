<?php

use App\Http\Controllers\AuditController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CircleController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SessionController;
use App\Http\Controllers\ShareController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StudentController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['status' => 'ok', 'service' => 'halaqtna-api', 'time' => now()->toIso8601String()]));

// Two authentication paths (FR1, FR2)
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/student-login', [AuthController::class, 'studentLogin']);

// The public progress card and the guardian's PDF are NOT here: they are served at
// GET /p/{token} and GET /p/{token}/report.pdf (routes/web.php), FR15 / FR21.

Route::middleware('auth.jwt')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Staff self-service — a teacher keeps their own details current (audited, FR18)
    Route::get('/me/profile', [ProfileController::class, 'show']);
    Route::patch('/me/profile', [ProfileController::class, 'update']);
    Route::post('/me/password', [ProfileController::class, 'changePassword']);

    // FR21 / UC25
    Route::post('/students/{id}/share-link', [ShareController::class, 'issue']);
    Route::get('/students/{id}/share-link', [ShareController::class, 'current']);
    Route::delete('/share-links/{linkId}', [ShareController::class, 'revoke']);

    Route::get('/forecast-evaluation', [CircleController::class, 'forecastEvaluation']);
    Route::get('/error-types', [SessionController::class, 'errorTypes']);
    Route::get('/surahs', [SessionController::class, 'surahs']);
    Route::get('/challenges', fn () => \App\Models\Challenge::all());
    Route::get('/badges', fn () => \App\Models\Badge::all());

    // FR3
    Route::post('/students/{id}/access-code', [AuthController::class, 'regenerateAccessCode']);

    // FR19 — deployment administration (circles, supervisors, settings)
    Route::get('/circles', [CircleController::class, 'index']);
    Route::post('/circles', [CircleController::class, 'store']);
    Route::get('/circles/{id}', [CircleController::class, 'show']);
    Route::put('/circles/{id}', [CircleController::class, 'update']);
    Route::delete('/circles/{id}', [CircleController::class, 'destroy']);
    Route::post('/circle-admins', [CircleController::class, 'storeCircleAdmin']);
    Route::get('/settings', [CircleController::class, 'settings']);
    Route::put('/settings', [CircleController::class, 'updateSettings']);

    // FR11 / FR14 / FR20 — circle-scoped, the Supervisor's and teachers' side of the system
    Route::get('/circles/{id}/roster', [CircleController::class, 'roster']);
    Route::get('/circles/{id}/dashboard', [CircleController::class, 'dashboard']);
    Route::get('/circles/{id}/leaderboard', [CircleController::class, 'leaderboard']);
    Route::get('/circles/{id}/report', [CircleController::class, 'report']);
    Route::get('/circles/{id}/report.pdf', [CircleController::class, 'reportPdf']);

    Route::get('/staff', [StaffController::class, 'index']);
    Route::post('/teachers', [StaffController::class, 'storeTeacher']);
    Route::patch('/staff/{id}', [StaffController::class, 'update']);
    Route::delete('/staff/{id}', [StaffController::class, 'destroy']);

    Route::get('/students', [StudentController::class, 'index']);
    Route::post('/students', [StudentController::class, 'store']);
    Route::get('/students/{id}', [StudentController::class, 'show']);
    Route::patch('/students/{id}', [StudentController::class, 'update']);
    Route::delete('/students/{id}', [StudentController::class, 'destroy']);
    Route::get('/students/{id}/metrics', [StudentController::class, 'metrics']);
    Route::get('/students/{id}/prediction', [StudentController::class, 'prediction']);
    Route::get('/students/{id}/sessions', [StudentController::class, 'sessions']);
    Route::get('/students/{id}/badges', [StudentController::class, 'badges']);
    Route::get('/students/{id}/xp', [StudentController::class, 'xp']);
    Route::get('/students/{id}/challenges', [StudentController::class, 'challenges']);
    Route::post('/students/{id}/challenges/{challengeId}/join', [StudentController::class, 'joinChallenge']);
    Route::get('/students/{id}/journey', [StudentController::class, 'journey']);
    Route::get('/students/{id}/report', [StudentController::class, 'report']);
    Route::get('/students/{id}/report.pdf', [StudentController::class, 'reportPdf']);

    // FR4 — the register, taken for the whole circle in one pass, outside the recitation form
    Route::get('/attendance', [SessionController::class, 'attendanceSheet']);
    Route::post('/attendance', [SessionController::class, 'markAttendance']);

    // FR5, FR6 — recitation sessions; every hand-entered row can be corrected or removed
    Route::post('/sessions', [SessionController::class, 'store']);
    Route::put('/sessions/{id}', [SessionController::class, 'update']);
    Route::delete('/sessions/{id}', [SessionController::class, 'destroy']);

    // FR18
    Route::get('/audit', [AuditController::class, 'index']);
});
