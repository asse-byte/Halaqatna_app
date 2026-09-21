@php
    /**
     * FR15 — the student report a teacher hands to a parent.
     *
     * Nothing on this page is a formula or a symbol. E(s), d_max and α belong to the
     * Analytics Engine, not to a parent reading about their child; each metric appears under
     * a phrase that says what it measures, with one explanatory line underneath.
     */
    use App\Support\ReportWords;
    $w = ReportWords::for($locale);
    $m = $metrics;
    $trend = $m['trend'] ?? [];
    $summary = $m['trend_summary'] ?? ['direction' => 'NEW'];
    // Width of the progress-bar track, in points. A4 portrait less 12 mm margins leaves
    // about 527 pt; the three label columns take 175 pt plus padding.
    $barTrack = 300;
    $align = $rtl ? 'right' : 'left';
    $num = fn ($v, $suffix = '') => $v === null ? '—' : $v.$suffix;
@endphp
<!doctype html>
<html lang="{{ $locale }}" dir="{{ $rtl ? 'rtl' : 'ltr' }}">
<head><meta charset="utf-8"></head>
<body style="color:#1d2b25;">

<table width="100%" style="border-bottom:2.5pt solid #0F382C; padding-bottom:4pt; margin-bottom:10pt;"><tr>
    <td style="text-align:{{ $align }};">
        <span style="font-size:17pt; font-weight:bold; color:#0F382C;">{{ $w['app'] }}</span>
        <span style="font-size:11pt; color:#6b7280;"> — {{ $w['student_report'] }}</span>
    </td>
    <td style="text-align:{{ $rtl ? 'left' : 'right' }}; font-size:8.5pt; color:#6b7280;">
        {{ $w['generated'] }}: <span dir="ltr">{{ now()->toDateString() }}</span>
    </td>
</tr></table>

<table width="100%" style="background:#f3f6f4; border:0.5pt solid #dfe6e2; padding:7pt; margin-bottom:10pt; font-size:9.5pt;"><tr>
    <td style="text-align:{{ $align }};">
        <span style="font-size:14pt; font-weight:bold; color:#0F382C;">{{ $student->name }}</span><br>
        <span style="color:#4b5563;">
            {{ $w['circle'] }}: {{ $student->circle->name }}
            &nbsp;·&nbsp; {{ $w['juz'] }}: {{ $student->current_juz }}
            @if($student->age) &nbsp;·&nbsp; {{ $w['age'] }}: {{ $student->age }} {{ $w['year'] }} @endif
        </span><br>
        <span style="color:#4b5563;">
            {{ $w['teachers'] }}: {{ $student->teachers->pluck('name')->join('، ') ?: $w['none'] }}
            @if($student->guardian_phone) &nbsp;·&nbsp; {{ $w['guardian'] }}: <span dir="ltr">{{ $student->guardian_phone }}</span> @endif
        </span>
    </td>
    <td width="130" style="text-align:center;">
        <div style="font-size:26pt; font-weight:bold; color:#0F382C; line-height:1;">{{ $num($m['mastery']) }}</div>
        <div style="font-size:8pt; color:#6b7280;">{{ $w['mastery'] }} / 100</div>
        <div style="margin-top:3pt; font-size:9.5pt; font-weight:bold; color:#0f7b6c;">{{ $w['band_'.$band] }}</div>
    </td>
</tr></table>

{{-- The five measured qualities, each under a plain phrase and a line of explanation. --}}
<table width="100%" cellpadding="6" style="border-collapse:collapse; margin-bottom:9pt; font-size:8.5pt;">
    @foreach([
        ['momentum', $num($m['momentum']), $locale === 'ar' ? 'صفحة/أسبوع' : 'pages/week'],
        ['precision', $num($m['precision']), '%'],
        ['consistency', $num($m['consistency']), '%'],
        ['review_depth', $num($m['review_depth']), $locale === 'ar' ? 'صفحة مراجعة' : 'review pages'],
    ] as $i => [$key, $value, $unit])
        @if($i % 2 === 0) <tr> @endif
        <td width="50%" style="border:0.5pt solid #e5e7eb; text-align:{{ $align }};">
            <span style="font-size:15pt; font-weight:bold; color:#0F382C;">{{ $value }}</span>
            <span style="color:#6b7280;"> {{ $unit }}</span><br>
            <span style="font-weight:bold;">{{ $w[$key] }}</span><br>
            <span style="color:#7b8580; font-size:7.5pt;">{{ $w[$key.'_hint'] }}</span>
        </td>
        @if($i % 2 === 1) </tr> @endif
    @endforeach
</table>

<table width="100%" cellpadding="6" style="border-collapse:collapse; margin-bottom:10pt; font-size:8.5pt; text-align:center;"><tr>
    @foreach([
        ['total_pages', $m['total_pages']],
        ['sessions', $m['sessions_count']],
        ['attendance_rate', round(($m['attendance_rate'] ?? 0) * 100).'%'],
        ['errors_total', $m['error_count'] ?? 0],
        ['trend', $w['trend_'.$summary['direction']]],
    ] as [$key, $value])
        <td style="border:0.5pt solid #e5e7eb;">
            <div style="font-size:13pt; font-weight:bold; color:#0F382C;">{{ $value }}</div>
            <div style="color:#6b7280; font-size:7.5pt;">{{ $w[$key] }}</div>
        </td>
    @endforeach
</tr></table>

<table width="100%" style="border:0.5pt solid #dfe6e2; padding:7pt; margin-bottom:10pt; font-size:9.5pt;"><tr>
    <td style="text-align:{{ $align }};">
        <span style="color:#6b7280; font-size:8pt;">{{ $w['forecast'] }}</span><br>
        @if($prediction && $prediction->predicted_completion_date)
            <span style="font-size:14pt; font-weight:bold; color:#0F382C;" dir="ltr">{{ $prediction->predicted_completion_date }}</span>
            <span style="color:#4b5563;"> — {{ str_replace('{n}', (int) $prediction->eta_days, $w['days_left']) }}</span>
        @else
            <span style="color:#6b7280;">{{ $w['forecast_none'] }}</span>
        @endif
    </td>
    <td width="200" style="text-align:{{ $align }};">
        <span style="color:#6b7280; font-size:8pt;">{{ $w['badges'] }}</span><br>
        <span>{{ $badges->map(fn ($b) => $rtl ? $b->name_ar : $b->name_en)->join('، ') ?: $w['none'] }}</span>
    </td>
</tr></table>

@if(count($trend) > 1)
    {{-- The rising-or-falling picture, drawn as bars so it survives a black-and-white print. --}}
    <div style="font-weight:bold; color:#0F382C; margin-bottom:4pt;">{{ $w['progress'] }}</div>
    <table width="100%" cellpadding="4" style="border-collapse:collapse; margin-bottom:12pt; font-size:8pt;">
        <thead><tr style="background:#0F382C; color:#fff;">
            <th width="80" style="padding:4pt;">{{ $w['week'] }}</th>
            <th width="50">{{ $w['pages'] }}</th>
            <th width="45">{{ $w['level'] }}</th>
            <th>&nbsp;</th>
        </tr></thead>
        <tbody>
        @foreach(array_slice($trend, -10) as $row)
            @php $lvl = (int) round($row['level'] ?? 0); @endphp
            <tr style="border-bottom:0.5pt solid #eef1ef;">
                <td style="text-align:center;" dir="ltr">{{ $row['week'] }}</td>
                <td style="text-align:center;">{{ $row['pages'] }}</td>
                <td style="text-align:center; font-weight:bold; color:#0F382C;">{{ $row['level'] === null ? '—' : $lvl }}</td>
                {{-- A bar the eye can follow down the column: longer means fewer mistakes per page.
                     Two coloured cells at explicit point widths — mPDF resolves percentages
                     inside a nested table against the content, which made every bar the same
                     length, so the geometry is stated in points instead. --}}
                @php $bar = max(2, (int) round($lvl / 100 * $barTrack)); @endphp
                <td style="padding:2pt 4pt;">
                    <table width="{{ $barTrack }}" cellspacing="0" cellpadding="0" style="border-collapse:collapse; table-layout:fixed;"><tr>
                        <td width="{{ $bar }}" bgcolor="#2f6f4f"><div style="font-size:5pt; line-height:7pt;">&nbsp;</div></td>
                        @if($bar < $barTrack)
                            <td width="{{ $barTrack - $bar }}" bgcolor="#eef1ef"><div style="font-size:5pt; line-height:7pt;">&nbsp;</div></td>
                        @endif
                    </tr></table>
                </td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<div style="font-weight:bold; color:#0F382C; margin-bottom:4pt;">{{ $w['history'] }}</div>
@if($sessions->isEmpty())
    <div style="color:#6b7280; font-size:9pt;">{{ $w['no_sessions'] }}</div>
@else
    <table width="100%" cellpadding="4" style="border-collapse:collapse; font-size:8pt;">
        <thead><tr style="background:#0F382C; color:#fff;">
            <th style="padding:4pt;">{{ $w['date'] }}</th>
            <th>{{ $w['attendance'] }}</th>
            <th>{{ $w['type'] }}</th>
            <th>{{ $w['range'] }}</th>
            <th>{{ $w['pages'] }}</th>
            <th>{{ $w['errors'] }}</th>
            <th>{{ $w['accuracy'] }}</th>
            <th>{{ $w['teacher'] }}</th>
        </tr></thead>
        <tbody>
        @foreach($sessions as $s)
            <tr style="border-bottom:0.5pt solid #eef1ef; text-align:center;">
                <td dir="ltr">{{ $s['session_date'] }}</td>
                <td>{{ $w['att_'.$s['attendance_status']] }}</td>
                {{-- No passage recorded means nothing was recited — an absence, or an excused
                     one. Range::range() already returns an em dash in that case, so the type
                     follows it rather than repeating whatever the row happens to carry. --}}
                <td>{{ $s['range'] === '—' ? '—' : $w['type_'.$s['session_type']] }}</td>
                <td style="text-align:{{ $align }};">{{ $s['range'] }}</td>
                <td>{{ $s['pages_memorized'] }}</td>
                <td>{{ $s['error_count'] }}</td>
                <td>{{ $s['accuracy'] === null ? '—' : $s['accuracy'].'%' }}</td>
                <td style="text-align:{{ $align }};">{{ $s['teacher'] ?? '—' }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<div style="margin-top:14pt; padding-top:5pt; border-top:0.5pt solid #e5e7eb; font-size:7.5pt; color:#9ca3af; text-align:{{ $align }};">
    {{ $w['footer_note'] }}
</div>
</body></html>
