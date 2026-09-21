<?php

namespace App\Services;

use Mpdf\Mpdf;

/**
 * The single place a PDF is produced.
 *
 * The first build rendered reports with DomPDF. DomPDF performs no Arabic shaping and no
 * bidirectional reordering: it draws one isolated glyph per code point, left to right, so
 * every Arabic report came out as disconnected letters running the wrong way — unreadable
 * to the parent it was meant for, and in breach of NFR6, which requires both languages to
 * work, not merely to exist in the locale file.
 *
 * mPDF does both jobs itself. It joins each letter to its neighbours, applies the Unicode
 * bidirectional algorithm so Arabic runs read right-to-left while dates and page counts
 * stay left-to-right inside them, and ships XB Riyaz, an Arabic typeface with the coverage
 * the reports need. The English report keeps DejaVu Sans.
 */
class PdfRenderer
{
    /** Where mPDF keeps its font cache. Inside storage so nothing is written outside the app. */
    private function tempDir(): string
    {
        $dir = storage_path('app/mpdf');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        return $dir;
    }

    public function render(string $view, array $data, string $locale = 'ar', string $orientation = 'P'): string
    {
        $rtl = $locale === 'ar';
        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => $orientation === 'L' ? 'A4-L' : 'A4',
            'orientation' => $orientation,
            'tempDir' => $this->tempDir(),
            'default_font' => $rtl ? 'xbriyaz' : 'dejavusanscondensed',
            'default_font_size' => 10,
            'margin_left' => 12, 'margin_right' => 12,
            'margin_top' => 14, 'margin_bottom' => 16,
            'margin_footer' => 8,
            // Lets a number or an English word inside an Arabic sentence pick a font that
            // has the glyph, instead of falling back to an empty box.
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
        ]);
        $mpdf->SetDirectionality($rtl ? 'rtl' : 'ltr');
        $mpdf->SetTitle($data['doc_title'] ?? 'Halaqtna');
        $mpdf->SetAuthor('Halaqtna');
        $mpdf->SetHTMLFooter(
            '<div style="font-size:8pt;color:#8a8f8c;'.($rtl ? 'text-align:left' : 'text-align:right').'">'
            .($rtl ? 'صفحة ' : 'Page ').'{PAGENO} / {nbpg}</div>'
        );
        $mpdf->WriteHTML(view($view, $data + ['locale' => $locale, 'rtl' => $rtl])->render());

        return $mpdf->Output('', 'S');
    }
}
