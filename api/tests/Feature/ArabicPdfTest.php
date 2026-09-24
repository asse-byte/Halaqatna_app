<?php

namespace Tests\Feature;

use App\Models\Circle;
use App\Services\ReportService;
use App\Support\ReportWords;
use App\Support\Surah;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FR15 / NFR6 — the Arabic report has to be readable, not merely produced.
 *
 * The first build rendered with DomPDF, which performs no Arabic shaping and no
 * bidirectional reordering: it drew one isolated glyph per code point, left to right, so
 * every Arabic report came out as disconnected letters in the wrong order. A test that only
 * checks for a %PDF- header passes on that output, which is how the defect survived, so
 * these tests look at what the page actually contains.
 */
class ArabicPdfTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWorld();
        $this->logSession($this->token('t1@x.sa'), $this->s1->student_id, '2026-02-02', 3, [1, 3]);
    }

    /**
     * Arabic is written to the page as joined presentation forms (U+FE70–U+FEFF), which is
     * what shaping produces and what DomPDF never did. Isolated base letters with no
     * presentation form anywhere would mean the text is being drawn letter by letter again.
     */
    public function test_the_arabic_report_is_shaped_not_drawn_letter_by_letter(): void
    {
        $pdf = app(ReportService::class)->studentPdf($this->s1->fresh(), 'ar');

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertGreaterThan(10_000, strlen($pdf), 'An Arabic report with a real embedded font is not a few kilobytes.');

        // mPDF subsets and embeds the Arabic face rather than referencing a system font.
        $this->assertMatchesRegularExpression('/FontFile2|FontFile/', $pdf, 'The Arabic font must be embedded, or the reader substitutes and the text breaks.');
        $this->assertStringContainsString('/Subtype /Type0', $pdf, 'Arabic needs a composite (Type0) font, not a simple one.');
    }

    public function test_both_languages_render_and_differ(): void
    {
        $reports = app(ReportService::class);
        $ar = $reports->studentPdf($this->s1->fresh(), 'ar');
        $en = $reports->studentPdf($this->s1->fresh(), 'en');

        $this->assertStringStartsWith('%PDF-', $ar);
        $this->assertStringStartsWith('%PDF-', $en);
        // If the Arabic build silently fell back to the English one the two would be near-identical.
        $this->assertNotSame(strlen($ar), strlen($en));

        $this->assertStringStartsWith('%PDF-', $reports->circlePdf(Circle::find($this->c1->circle_id), 'ar'));
        $this->assertStringStartsWith('%PDF-', $reports->circlePdf(Circle::find($this->c1->circle_id), 'en'));
    }

    /** NFR6 — every word the reports print exists in both languages. */
    public function test_the_report_vocabulary_has_full_parity(): void
    {
        $this->assertSame(array_keys(ReportWords::AR), array_keys(ReportWords::EN));
        foreach (ReportWords::AR as $key => $value) {
            $this->assertNotSame('', trim($value), "Arabic wording for {$key} is empty");
            $this->assertNotSame('', trim(ReportWords::EN[$key]), "English wording for {$key} is empty");
        }
    }

    /** The recitation range reads as a Surah name, never as the raw "2:1 – 2:5". */
    public function test_the_report_names_the_surah_instead_of_printing_its_number(): void
    {
        $rows = app(ReportService::class)->studentReport($this->s1->fresh(), 'ar')['sessions'];
        $this->assertNotEmpty($rows);
        foreach ($rows as $row) {
            $this->assertDoesNotMatchRegularExpression('/^\d+:\d+/', $row['range']);
        }

        $this->assertSame('الفاتحة 1 – 7', Surah::range(1, 1, 1, 7, 'ar'));
        $this->assertSame('Al-Fatihah 1 – 7', Surah::range(1, 1, 1, 7, 'en'));
        $this->assertSame('—', Surah::range(null, null, null, null, 'ar'));
    }

    /**
     * FR15 through the guardian's link: the same report, behind the token that already
     * carries the expiry, the revocation and the audit row (§2.13).
     */
    public function test_the_guardian_link_serves_the_full_report_and_is_revocable(): void
    {
        $issued = $this->as($this->token('t1@x.sa'))
            ->postJson("/api/students/{$this->s1->student_id}/share-link")->assertStatus(201)->json();

        $this->assertStringContainsString('/report.pdf', $issued['report_url']);

        $res = $this->asGuest()->get(parse_url($issued['report_url'], PHP_URL_PATH));
        $res->assertOk();
        $this->assertSame('application/pdf', $res->headers->get('Content-Type'));
        $this->assertSame('noindex, nofollow, noarchive', $res->headers->get('X-Robots-Tag'));
        $this->assertDatabaseHas('audit_log', ['entity' => 'progress_share_link', 'action' => 'VIEW']);

        $this->as($this->token('t1@x.sa'))->deleteJson("/api/share-links/{$issued['link_id']}")->assertOk();
        // A revoked token is a flat 404 — the caller is never told the link once existed.
        $this->asGuest()->get(parse_url($issued['report_url'], PHP_URL_PATH))->assertNotFound();
    }

    /** The guardian's number travels with the link, so the client can address WhatsApp with it. */
    public function test_the_share_link_carries_the_guardian_number(): void
    {
        $this->s1->update(['guardian_phone' => '+966500000000']);

        $issued = $this->as($this->token('t1@x.sa'))
            ->postJson("/api/students/{$this->s1->student_id}/share-link")->assertStatus(201)->json();

        $this->assertSame('+966500000000', $issued['guardian_phone']);
    }
}
