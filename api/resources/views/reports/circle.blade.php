@php
    /** FR14 — the circle term report the Supervisor produces. Same plain vocabulary as the student report. */
    use App\Support\ReportWords;
    $w = ReportWords::for($locale);
    $s = $summary;
    $align = $rtl ? 'right' : 'left';
    $num = fn ($v, $suffix = '') => $v === null ? '—' : $v.$suffix;
    // Direction is carried by the word and its colour. Arrow glyphs were dropped: the Arabic
    // face ships no ▲/▼, so each one printed as an empty box next to the word it repeated.
    $tone = ['UP' => '#0f7b6c', 'DOWN' => '#9a4b2f', 'STEADY' => '#6b7280', 'NEW' => '#9ca3af'];
@endphp
<!doctype html>
<html lang="{{ $locale }}" dir="{{ $rtl ? 'rtl' : 'ltr' }}">
<head><meta charset="utf-8"></head>
<body style="color:#1d2b25;">

<table width="100%" style="border-bottom:2.5pt solid #0F382C; padding-bottom:4pt; margin-bottom:10pt;"><tr>
    <td style="text-align:{{ $align }};">
        <span style="font-size:17pt; font-weight:bold; color:#0F382C;">{{ $w['app'] }}</span>
        <span style="font-size:11pt; color:#6b7280;"> — {{ $w['circle_report'] }}</span><br>
        <span style="font-size:9.5pt; color:#4b5563;">{{ $circle->name }}@if($circle->location) &nbsp;·&nbsp; {{ $circle->location }} @endif</span>
    </td>
    <td style="text-align:{{ $rtl ? 'left' : 'right' }}; font-size:8.5pt; color:#6b7280;">
        {{ $w['generated'] }}: <span dir="ltr">{{ $generated_at }}</span>
    </td>
</tr></table>

<table width="100%" cellpadding="6" style="border-collapse:collapse; margin-bottom:12pt; font-size:8.5pt; text-align:center;"><tr>
    @foreach([
        ['students', $s['students']],
        ['sessions', $s['sessions']],
        ['total_pages', $s['total_pages']],
        ['avg_mastery', $num($s['avg_mastery'])],
        ['avg_momentum', $num($s['avg_momentum'])],
        ['avg_precision', $num($s['avg_precision'], '%')],
        ['avg_consistency', $num($s['avg_consistency'], '%')],
    ] as [$key, $value])
        <td style="border:0.5pt solid #e5e7eb;">
            <div style="font-size:15pt; font-weight:bold; color:#0F382C;">{{ $value }}</div>
            <div style="color:#6b7280; font-size:7.5pt;">{{ $w[$key] }}</div>
        </td>
    @endforeach
</tr></table>

<table width="100%" cellpadding="4" style="border-collapse:collapse; font-size:8pt;">
    <thead><tr style="background:#0F382C; color:#fff;">
        <th style="padding:5pt; text-align:{{ $align }};">{{ $w['student'] }}</th>
        <th>{{ $w['juz'] }}</th>
        <th>{{ $w['sessions'] }}</th>
        <th>{{ $w['total_pages'] }}</th>
        <th>{{ $w['mastery'] }}</th>
        <th>{{ $w['momentum'] }}</th>
        <th>{{ $w['precision'] }}</th>
        <th>{{ $w['consistency'] }}</th>
        <th>{{ $w['review_depth'] }}</th>
        <th>{{ $w['attendance_rate'] }}</th>
        <th>{{ $w['trend'] }}</th>
    </tr></thead>
    <tbody>
    @foreach($students as $st)
        <tr style="border-bottom:0.5pt solid #eef1ef; text-align:center;">
            <td style="text-align:{{ $align }}; font-weight:bold;">{{ $st['name'] }}</td>
            <td>{{ $st['current_juz'] }}</td>
            <td>{{ $st['sessions_count'] }}</td>
            <td>{{ $st['total_pages'] }}</td>
            <td>{{ $num($st['mastery']) }}</td>
            <td>{{ $num($st['momentum']) }}</td>
            <td>{{ $num($st['precision'], '%') }}</td>
            <td>{{ $num($st['consistency'], '%') }}</td>
            <td>{{ $num($st['review_depth']) }}</td>
            <td>{{ round(($st['attendance_rate'] ?? 0) * 100) }}%</td>
            <td style="color:{{ $tone[$st['trend']] }}; font-weight:bold;">{{ $w['trend_'.$st['trend']] }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

{{-- The metrics carry plain names in the table head; this legend says what each one means. --}}
<table width="100%" style="margin-top:10pt; font-size:7.5pt; color:#7b8580;"><tr>
    @foreach(['mastery', 'momentum', 'precision'] as $key)
        <td width="33%" style="text-align:{{ $align }}; padding-{{ $rtl ? 'left' : 'right' }}:8pt;">
            <b>{{ $w[$key] }}:</b> {{ $w[$key.'_hint'] }}
        </td>
    @endforeach
</tr><tr>
    @foreach(['consistency', 'review_depth'] as $key)
        <td style="text-align:{{ $align }}; padding-{{ $rtl ? 'left' : 'right' }}:8pt; padding-top:3pt;">
            <b>{{ $w[$key] }}:</b> {{ $w[$key.'_hint'] }}
        </td>
    @endforeach
    <td></td>
</tr></table>

<div style="margin-top:10pt; padding-top:5pt; border-top:0.5pt solid #e5e7eb; font-size:7.5pt; color:#9ca3af; text-align:{{ $align }};">
    {{ $w['footer_note'] }}
</div>
</body></html>
