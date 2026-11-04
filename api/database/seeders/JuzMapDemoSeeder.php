<?php

namespace Database\Seeders;

use App\Models\RecitationSession;
use App\Models\Student;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * Demo data for the journey map: the first student recites An-Naba, An-Nazi'at and Abasa in
 * full, so that Juz 30 opens with three gold stars. A star is earned from recorded passages,
 * and the ordinary demo sessions only ever cover part of a Surah.
 *
 * Safe to run on a demo database that already exists, and safe to run twice:
 *   php artisan db:seed --class=JuzMapDemoSeeder
 * Refuses to run in production. The rows are synthetic and must not feed any reported result.
 */
class JuzMapDemoSeeder extends Seeder
{
    private const PASSAGES = [[78, 40, 2.0], [79, 46, 2.0], [80, 42, 1.5]];

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new \RuntimeException('JuzMapDemoSeeder writes demo sessions and does not run in production.');
        }
        $student = Student::orderBy('student_id')->first();
        $teacher = $student?->teachers()->first();
        if (!$teacher) return;

        // One session per student per day (Table 4.1), so these take days with nothing recorded.
        $taken = $student->sessions()->pluck('session_date')->all();
        $day = Carbon::yesterday();
        foreach (self::PASSAGES as [$surah, $ayahs, $pages]) {
            if ($student->sessions()->where(['surah_from' => $surah, 'ayah_from' => 1, 'ayah_to' => $ayahs])->exists()) continue;
            while (in_array($day->toDateString(), $taken, true)) $day->subDay();
            RecitationSession::create([
                'student_id' => $student->student_id, 'user_id' => $teacher->user_id, 'session_date' => $day->toDateString(),
                'surah_from' => $surah, 'ayah_from' => 1, 'surah_to' => $surah, 'ayah_to' => $ayahs,
                // Review, so the demo stars do not change how far through a Juz the student is.
                'pages_memorized' => $pages, 'attendance_status' => 'P', 'session_type' => 'REVIEW',
            ]);
            $taken[] = $day->toDateString();
        }
    }
}
