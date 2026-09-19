<?php

namespace App\Http\Controllers;

use App\Models\ProgressShareLink;
use App\Models\Student;
use App\Services\AnalyticsEngine;
use App\Services\MlClient;
use Illuminate\Http\Request;

/**
 * FR21 / UC25, UC26 — parent progress link.
 *
 * The viewer is a link holder, NOT a system actor: no account, no registration, no
 * credential they choose. The teacher produces an artifact and hands it over, exactly
 * as with the FR15 PDF; the only difference is that the artifact is a live page.
 *
 * §2.13 governs everything here: long random token, expiry, revocation, MINIMUM data,
 * noindex, and an audit row on every view. None of it may be weakened for convenience.
 */
class ShareController extends Controller
{
    /** Mastery is published as a band, never as the raw score (§2.13). */
    public const BANDS = [90 => 'EXCELLENT', 75 => 'STRONG', 50 => 'DEVELOPING', 0 => 'NEEDS_WORK'];

    public static function masteryBand(?float $mastery): string
    {
        if ($mastery === null) return 'NO_DATA';
        foreach (self::BANDS as $floor => $band) {
            if ($mastery >= $floor) return $band;
        }
        return 'NEEDS_WORK';
    }

    /** UC25 — issue a link. Only the student's own teacher (or the circle admin / Sys Admin). */
    public function issue(Request $r, int $id)
    {
        $a = $this->actor($r);
        $this->rbac->requireRole($a, ['TEACHER', 'CIRCLE_ADMIN', 'SYS_ADMIN']);
        $days = (int) $r->input('days', 30);   // §2.13 default expiry: 30 days
        $link = $this->rbac->issueShareLink($a, Student::findOrFail($id), $days > 0 ? $days : 30);
        $this->audit->log($a, 'CREATE', 'progress_share_link', $link->link_id, ['student_id' => $id, 'expires_at' => (string) $link->expires_at]);

        return response()->json([
            'link_id' => $link->link_id,
            'url' => url('/p/'.$link->token),
            'expires_at' => $link->expires_at,
        ], 201);
    }

    /** UC25 — the teacher's view of the live link, so it can be re-shared or revoked. */
    public function current(Request $r, int $id)
    {
        $student = Student::findOrFail($id);
        $this->rbac->requireStudentManagement($this->actor($r), $student);
        $link = ProgressShareLink::where('student_id', $id)->whereNull('revoked_at')->where('expires_at', '>', now())->latest('link_id')->first();

        return response()->json($link ? [
            'link_id' => $link->link_id,
            'url' => url('/p/'.$link->token),
            'expires_at' => $link->expires_at,
            'view_count' => $link->view_count,
            'last_viewed_at' => $link->last_viewed_at,
        ] : null);
    }

    /** UC25 — revoke. The teacher who created it can revoke it at any time (§2.13). */
    public function revoke(Request $r, int $linkId)
    {
        $a = $this->actor($r);
        $link = ProgressShareLink::find($linkId);
        // An unknown link id is a 404 for the same reason an unknown token is: do not
        // confirm that a link exists to someone who is not allowed to know.
        abort_if(!$link, 404, 'Not found');
        $this->rbac->requireShareLinkControl($a, $link);
        if ($link->revoked_at === null) {
            $link->revoked_at = now();
            $link->save();
        }
        $this->audit->log($a, 'UPDATE', 'progress_share_link', $link->link_id, ['student_id' => $link->student_id, 'event' => 'revoked']);

        return response()->json(['link_id' => $link->link_id, 'revoked_at' => $link->revoked_at]);
    }

    /**
     * UC26 — the public card. No authentication; the token is the only credential.
     * Unknown, expired and revoked tokens are all 404 (§2.13).
     */
    public function card(Request $r, string $token, AnalyticsEngine $analytics, MlClient $ml)
    {
        $link = $this->rbac->resolveShareToken($token);
        $student = $link->student()->firstOrFail();

        $metrics = $analytics->metrics($student);
        $week = now()->startOfWeek();
        $thisWeek = $student->sessions()->whereDate('session_date', '>=', $week->toDateString())->get();
        $prediction = $ml->latest($student);

        // §2.13 — the MINIMUM: first name, pages this week, attendance this week,
        // current Juz, mastery BAND, and the ETA date. Nothing else may be added here.
        $card = [
            'first_name' => explode(' ', trim($student->name))[0],
            'pages_this_week' => round((float) $thisWeek->sum('pages_memorized'), 2),
            'attended_this_week' => $thisWeek->whereIn('attendance_status', ['P', 'L'])->count(),
            'sessions_this_week' => $thisWeek->count(),
            'current_juz' => (int) $student->current_juz,
            'mastery_band' => self::masteryBand($metrics['mastery']),
            'predicted_completion_date' => $prediction?->predicted_completion_date,
        ];

        // Every view is audited (FR18). The link holder is not a system actor, so the row
        // has no actor_user_id; the link and student it concerns are in the payload.
        $link->increment('view_count');
        $link->last_viewed_at = now();
        $link->save();
        $this->audit->anonymous('VIEW', 'progress_share_link', $link->link_id, [
            'student_id' => $student->student_id,
            'ip' => $r->ip(),
            'view_count' => $link->view_count,
        ]);

        $locale = in_array($r->query('lang'), ['ar', 'en'], true) ? $r->query('lang') : ($student->locale ?: 'ar');

        // noindex header + meta tag in the view, so the page is never indexed (§2.13).
        return response()
            ->view('share.card', ['card' => $card, 'locale' => $locale, 'expires_at' => $link->expires_at])
            ->header('X-Robots-Tag', 'noindex, nofollow, noarchive')
            ->header('Referrer-Policy', 'no-referrer')
            ->header('Cache-Control', 'no-store, private');
    }
}
