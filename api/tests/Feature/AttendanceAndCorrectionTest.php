<?php

namespace Tests\Feature;

use App\Models\RecitationSession;
use App\Models\XpLedger;
use App\Services\GamificationEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FR4 taken as a register on its own, and the correction paths that make every hand-typed
 * figure in the system fixable.
 */
class AttendanceAndCorrectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
    }

    // ---- FR4: the register, outside the recitation form ----

    public function test_a_teacher_takes_the_register_for_the_whole_circle_in_one_call(): void
    {
        $t = $this->token('t1@x.sa');

        $sheet = $this->as($t)->getJson('/api/attendance?session_date=2026-03-01')->assertOk()->json();
        $this->assertSame('2026-03-01', $sheet['session_date']);
        // A teacher's sheet holds their own students only (FR16).
        $this->assertSame([$this->s1->student_id], collect($sheet['rows'])->pluck('student_id')->all());
        $this->assertNull($sheet['rows'][0]['attendance_status']);

        $this->as($t)->postJson('/api/attendance', [
            'session_date' => '2026-03-01',
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'E']],
        ])->assertOk()->assertJsonPath('saved', 1);

        $this->assertDatabaseHas('session', ['student_id' => $this->s1->student_id, 'session_date' => '2026-03-01', 'attendance_status' => 'E']);
        $this->assertDatabaseHas('audit_log', ['entity' => 'session', 'actor_user_id' => $this->t1->user_id]);

        // Re-marking the same day updates the one row Table 4.1 allows, it does not add a second.
        $this->as($t)->postJson('/api/attendance', [
            'session_date' => '2026-03-01',
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'P']],
        ])->assertOk();
        $this->assertSame(1, RecitationSession::where('student_id', $this->s1->student_id)->count());
        $this->assertSame('P', RecitationSession::where('student_id', $this->s1->student_id)->value('attendance_status'));
    }

    /** "Late" is no longer part of the vocabulary the register offers. */
    public function test_the_register_offers_present_absent_and_excused_only(): void
    {
        $t = $this->token('t1@x.sa');
        $this->as($t)->postJson('/api/attendance', [
            'session_date' => '2026-03-02',
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'L']],
        ])->assertStatus(422);

        $this->as($t)->postJson('/api/sessions', [
            'student_id' => $this->s1->student_id, 'session_date' => '2026-03-02',
            'attendance_status' => 'L', 'pages_memorized' => 1,
        ])->assertStatus(422);
    }

    public function test_a_session_type_is_new_memorization_or_review(): void
    {
        $this->as($this->token('t1@x.sa'))->postJson('/api/sessions', [
            'student_id' => $this->s1->student_id, 'session_date' => '2026-03-03',
            'attendance_status' => 'P', 'pages_memorized' => 1, 'session_type' => 'MIXED',
        ])->assertStatus(422);
    }

    /** A student marked on the register and then heard reciting is one session, not a clash. */
    public function test_a_recitation_fills_in_the_row_the_register_already_created(): void
    {
        $t = $this->token('t1@x.sa');
        $this->as($t)->postJson('/api/attendance', [
            'session_date' => '2026-03-04',
            'entries' => [['student_id' => $this->s1->student_id, 'attendance_status' => 'P']],
        ])->assertOk();

        $this->as($t)->postJson('/api/sessions', [
            'student_id' => $this->s1->student_id, 'session_date' => '2026-03-04',
            'attendance_status' => 'P', 'pages_memorized' => 2, 'surah_from' => 1, 'ayah_from' => 1, 'surah_to' => 1, 'ayah_to' => 7,
        ])->assertStatus(201);

        $this->assertSame(1, RecitationSession::where('student_id', $this->s1->student_id)->count());
        $this->assertEqualsWithDelta(2.0, (float) RecitationSession::where('student_id', $this->s1->student_id)->value('pages_memorized'), 0.001);

        // A second recitation on the same day is a genuine clash and is refused.
        $this->as($t)->postJson('/api/sessions', [
            'student_id' => $this->s1->student_id, 'session_date' => '2026-03-04',
            'attendance_status' => 'P', 'pages_memorized' => 1,
        ])->assertStatus(409);
    }

    // ---- FR5: the recitation range is checked against the Surah actually chosen ----

    public function test_an_ayah_beyond_the_end_of_the_surah_is_refused(): void
    {
        $t = $this->token('t1@x.sa');
        // Al-Fatihah has seven ayahs.
        $this->as($t)->postJson('/api/sessions', [
            'student_id' => $this->s1->student_id, 'session_date' => '2026-03-05',
            'attendance_status' => 'P', 'pages_memorized' => 1,
            'surah_from' => 1, 'ayah_from' => 1, 'surah_to' => 1, 'ayah_to' => 100,
        ])->assertStatus(422);

        // And a range that ends before it starts.
        $this->as($t)->postJson('/api/sessions', [
            'student_id' => $this->s1->student_id, 'session_date' => '2026-03-05',
            'attendance_status' => 'P', 'pages_memorized' => 1,
            'surah_from' => 5, 'ayah_from' => 10, 'surah_to' => 2, 'ayah_to' => 3,
        ])->assertStatus(422);
    }

    public function test_the_surah_list_is_served_with_names_and_ayah_counts(): void
    {
        $rows = $this->as($this->token('t1@x.sa'))->getJson('/api/surahs')->assertOk()->json();
        $this->assertCount(114, $rows);
        $this->assertSame(['number' => 1, 'name_ar' => 'الفاتحة', 'name_en' => 'Al-Fatihah', 'ayah_count' => 7], $rows[0]);
        $this->assertSame(6236, collect($rows)->sum('ayah_count'));
    }

    // ---- correcting what was typed ----

    public function test_a_session_can_be_corrected_and_the_correction_is_audited(): void
    {
        $t = $this->token('t1@x.sa');
        $id = $this->logSession($t, $this->s1->student_id, '2026-03-06', 3, [1, 3])->assertStatus(201)->json('session.session_id');

        $this->as($t)->putJson("/api/sessions/{$id}", [
            'session_date' => '2026-03-06', 'attendance_status' => 'P', 'pages_memorized' => 1.5,
            'session_type' => 'REVIEW', 'surah_from' => 2, 'ayah_from' => 1, 'surah_to' => 2, 'ayah_to' => 5,
            'errors' => [['error_type_id' => 4, 'ayah_ref' => '2:3']],
        ])->assertOk();

        $s = RecitationSession::find($id);
        $this->assertEqualsWithDelta(1.5, (float) $s->pages_memorized, 0.001);
        $this->assertSame('REVIEW', $s->session_type);
        // The error list is replaced wholesale, because the teacher edits it as a list.
        $this->assertSame([4], $s->errors()->pluck('error_type_id')->all());
        $this->assertDatabaseHas('audit_log', ['entity' => 'session', 'action' => 'UPDATE', 'entity_id' => $id]);
    }

    /**
     * xp_ledger is append-only (Table 4.1), so a correction cannot rewrite the rows already
     * written. The difference is posted as one ADJUST entry and the total comes out right.
     */
    public function test_correcting_a_session_settles_its_points_with_a_compensating_entry(): void
    {
        $t = $this->token('t1@x.sa');
        $id = $this->logSession($t, $this->s1->student_id, '2026-03-07', 3)->assertStatus(201)->json('session.session_id');

        $g = app(GamificationEngine::class);
        $before = $g->totalXp($this->s1->student_id);
        $this->assertSame(35, $before);   // 3 pages x 10, plus 5 for attending

        $this->as($t)->putJson("/api/sessions/{$id}", [
            'session_date' => '2026-03-07', 'attendance_status' => 'P', 'pages_memorized' => 1, 'session_type' => 'NEW',
        ])->assertOk();

        $this->assertSame(15, $g->totalXp($this->s1->student_id));
        $this->assertDatabaseHas('xp_ledger', ['student_id' => $this->s1->student_id, 'reason' => 'ADJUST', 'points' => -20]);
        // Nothing was deleted: the original award rows are still there.
        $this->assertTrue(XpLedger::where('session_id', $id)->where('reason', 'PAGE_MEMORIZED')->exists());
    }

    public function test_deleting_a_session_takes_its_points_with_it(): void
    {
        $t = $this->token('t1@x.sa');
        $id = $this->logSession($t, $this->s1->student_id, '2026-03-08', 2)->assertStatus(201)->json('session.session_id');
        $g = app(GamificationEngine::class);
        $this->assertSame(25, $g->totalXp($this->s1->student_id));

        $this->as($t)->deleteJson("/api/sessions/{$id}")->assertOk();

        $this->assertSame(0, $g->totalXp($this->s1->student_id));
        $this->assertDatabaseMissing('session', ['session_id' => $id]);
        $this->assertDatabaseHas('audit_log', ['entity' => 'session', 'action' => 'DELETE', 'entity_id' => $id]);
    }

    /** A teacher may only correct sessions of students assigned to them (FR16). */
    public function test_correcting_another_teachers_session_is_refused(): void
    {
        $id = $this->logSession($this->token('t2@x.sa'), $this->s2->student_id, '2026-03-09', 2)->assertStatus(201)->json('session.session_id');

        $this->as($this->token('t1@x.sa'))->putJson("/api/sessions/{$id}", [
            'session_date' => '2026-03-09', 'attendance_status' => 'P', 'pages_memorized' => 9,
        ])->assertStatus(403);
    }
}
