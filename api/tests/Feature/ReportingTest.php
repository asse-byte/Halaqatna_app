<?php

namespace Tests\Feature;

use App\Models\Circle;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * FR14 (term reports per student and per circle) and FR15 (PDF export).
 *
 * The Report Service is the ONLY component that writes to file storage (§6), so these
 * tests also pin that boundary: the PDF endpoints must produce a real file, and no other
 * flow may start writing reports.
 */
class ReportingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
        Storage::fake('local');
    }

    /** Two sessions for s1 so every metric in the report has something to compute from. */
    private function history(): void
    {
        $t = $this->token('t1@x.sa');
        $this->logSession($t, $this->s1->student_id, '2026-02-02', 3, [1, 3]);          // MEM_GAP + TAJ_ERR
        $this->logSession($t, $this->s1->student_id, '2026-02-04', 2, [2]);             // LNK_ERR
    }

    // ---- FR14: student term report ----

    public function test_student_report_carries_metrics_xp_and_every_session(): void
    {
        $this->history();

        $body = $this->as($this->token('t1@x.sa'))
            ->getJson("/api/students/{$this->s1->student_id}/report")
            ->assertOk()->json();

        $this->assertSame($this->s1->student_id, $body['student']['student_id']);
        $this->assertCount(2, $body['sessions']);
        $this->assertNotNull($body['metrics']['mastery']);
        $this->assertSame(5.0, (float) $body['metrics']['total_pages']);
        // FR13 — the total is the ledger sum, never a stored column.
        $this->assertSame($body['xp_total'], (int) \App\Models\XpLedger::where('student_id', $this->s1->student_id)->sum('points'));

        // §3.1 weighted error load is reported per session, from error_type.weight (3NF).
        $loads = collect($body['sessions'])->pluck('error_load')->sort()->values()->all();
        $this->assertEqualsWithDelta(0.50, $loads[0], 0.001);   // LNK_ERR
        $this->assertEqualsWithDelta(1.10, $loads[1], 0.001);   // MEM_GAP + TAJ_ERR
    }

    public function test_student_report_is_scoped_like_the_rest_of_the_student_data(): void
    {
        // Another teacher's student — FR16.
        $this->as($this->token('t2@x.sa'))->getJson("/api/students/{$this->s1->student_id}/report")->assertForbidden();
        // Another circle entirely.
        $this->as($this->token('a2@x.sa'))->getJson("/api/students/{$this->s1->student_id}/report")->assertForbidden();
    }

    // ---- FR14: circle term report ----

    public function test_circle_report_aggregates_every_student_in_the_circle(): void
    {
        $this->history();

        $body = $this->as($this->token('a1@x.sa'))
            ->getJson("/api/circles/{$this->c1->circle_id}/report")
            ->assertOk()->json();

        $this->assertSame(2, $body['summary']['students']);          // s1 and s2 are in c1
        $this->assertSame(5.0, (float) $body['summary']['total_pages']);
        $this->assertSame(2, $body['summary']['sessions']);
        $this->assertNotNull($body['generated_at']);

        $names = collect($body['students'])->pluck('name')->all();
        $this->assertContains($this->s1->name, $names);
        $this->assertContains($this->s2->name, $names);
        // s3 belongs to the other circle and must not appear.
        $this->assertNotContains($this->s3->name, $names);
    }

    /** FR14 is a Circle Administrator capability — a teacher gets the circle-wide report refused (§9 matrix). */
    public function test_circle_report_is_refused_to_a_teacher_and_to_another_circles_admin(): void
    {
        $this->as($this->token('t1@x.sa'))->getJson("/api/circles/{$this->c1->circle_id}/report")->assertForbidden();
        $this->as($this->token('a2@x.sa'))->getJson("/api/circles/{$this->c1->circle_id}/report")->assertForbidden();
    }

    public function test_circle_report_averages_ignore_students_with_no_data(): void
    {
        $this->history();   // only s1 has sessions; s2 has none

        $summary = $this->as($this->token('a1@x.sa'))
            ->getJson("/api/circles/{$this->c1->circle_id}/report")->assertOk()->json('summary');

        // s2's null mastery must be filtered out rather than counted as a zero.
        $s1Mastery = $this->as($this->token('t1@x.sa'))
            ->getJson("/api/students/{$this->s1->student_id}/metrics")->json('mastery');
        $this->assertEqualsWithDelta($s1Mastery, $summary['avg_mastery'], 0.1);
    }

    // ---- FR15: PDF export ----

    public function test_student_pdf_is_generated_and_stored(): void
    {
        $this->history();

        $res = $this->as($this->token('t1@x.sa'))->get("/api/students/{$this->s1->student_id}/report.pdf");

        $res->assertOk();
        $this->assertSame('application/pdf', $res->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF-', $res->getContent());

        // §6 — the Report Service is the only writer to file storage.
        $written = Storage::disk('local')->files('reports');
        $this->assertCount(1, $written);
        $this->assertStringContainsString("student_{$this->s1->student_id}_", $written[0]);
        $this->assertSame($res->getContent(), Storage::disk('local')->get($written[0]), 'the stored copy is the one that was served');
    }

    /**
     * Exporting the same report again replaces its stored copy instead of adding one. The
     * guardian's link is public, so a file per request would grow the disk without bound.
     */
    public function test_repeated_exports_keep_one_copy_per_report_and_language(): void
    {
        $this->history();
        $t = $this->token('t1@x.sa');

        foreach (['ar', 'ar', 'en', 'en', 'ar'] as $locale) {
            $this->as($t)->get("/api/students/{$this->s1->student_id}/report.pdf?locale={$locale}")->assertOk();
        }

        $this->assertCount(2, Storage::disk('local')->files('reports'));
    }

    public function test_circle_pdf_is_generated_and_stored(): void
    {
        $this->history();

        $res = $this->as($this->token('a1@x.sa'))->get("/api/circles/{$this->c1->circle_id}/report.pdf");

        $res->assertOk();
        $this->assertSame('application/pdf', $res->headers->get('Content-Type'));
        $this->assertCount(1, Storage::disk('local')->files('reports'));
    }

    /** FR17 — reports render in both languages; the Arabic build must not fall back to English. */
    public function test_pdfs_render_in_arabic_and_english(): void
    {
        $this->history();
        $reports = app(ReportService::class);

        foreach (['en', 'ar'] as $locale) {
            $this->assertStringStartsWith('%PDF-', $reports->studentPdf($this->s1->fresh(), $locale));
        }
        $this->assertStringStartsWith('%PDF-', $reports->circlePdf(Circle::find($this->c1->circle_id), 'ar'));
    }

    public function test_pdf_export_is_refused_to_a_student(): void
    {
        $this->history();

        $this->as($this->studentToken('AAAA1111'))
            ->get("/api/students/{$this->s1->student_id}/report.pdf")
            ->assertForbidden();
    }

    /** A student with no sessions at all must still produce a report rather than dividing by zero. */
    public function test_report_for_a_student_with_no_sessions_is_empty_not_broken(): void
    {
        $body = $this->as($this->token('t2@x.sa'))
            ->getJson("/api/students/{$this->s2->student_id}/report")->assertOk()->json();

        $this->assertSame([], $body['sessions']);
        $this->assertNull($body['metrics']['mastery']);
        $this->assertSame(0, $body['xp_total']);
    }
}
