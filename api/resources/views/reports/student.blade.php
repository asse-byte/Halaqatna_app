<!DOCTYPE html>
<html dir="{{ $locale === 'ar' ? 'rtl' : 'ltr' }}">
<head>
<meta charset="utf-8">
<style>
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; }
  h1 { color: #0F382C; font-size: 20px; margin: 0 0 4px; }
  .muted { color: #6b7280; }
  .grid { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .grid td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: center; }
  .grid .v { font-size: 18px; font-weight: bold; color: #0F382C; }
  table.rows { width: 100%; border-collapse: collapse; }
  table.rows th { background: #0F382C; color: #fff; padding: 5px; font-size: 10px; }
  table.rows td { border-bottom: 1px solid #e5e7eb; padding: 4px 5px; }
  .tag { display: inline-block; padding: 1px 4px; border: 1px solid #d1d5db; border-radius: 3px; margin: 1px; font-size: 9px; }
  .footer { margin-top: 16px; font-size: 9px; color: #9ca3af; }
</style>
</head>
<body>
@php $ar = $locale === 'ar'; $m = $metrics; @endphp
<h1>{{ $ar ? 'حلقتنا — تقرير الطالب' : 'Halaqtna — Student Report' }}</h1>
<div class="muted">{{ $student->name }} · {{ $student->circle->name }} · {{ $ar ? 'الجزء' : 'Juz' }} {{ $student->current_juz }} · {{ now()->toDateString() }}</div>

<table class="grid"><tr>
  <td><div class="v">{{ $m['mastery'] ?? '—' }}</div>{{ $ar ? 'الإتقان' : 'Mastery' }}</td>
  <td><div class="v">{{ $m['momentum'] }}</div>{{ $ar ? 'الزخم (صفحة/أسبوع)' : 'Momentum (pages/wk)' }}</td>
  <td><div class="v">{{ $m['precision'] ?? '—' }}</div>{{ $ar ? 'الدقة' : 'Precision' }}</td>
  <td><div class="v">{{ $m['consistency'] ?? '—' }}</div>{{ $ar ? 'الانتظام' : 'Consistency' }}</td>
  <td><div class="v">{{ $m['review_depth'] ?? '—' }}</div>{{ $ar ? 'عمق المراجعة' : 'Review depth' }}</td>
  <td><div class="v">{{ $xp_total }}</div>XP</td>
</tr></table>

<p><strong>{{ $ar ? 'التوقع' : 'Forecast' }}:</strong>
@if($prediction) {{ $prediction->predicted_completion_date }} ({{ $prediction->eta_days }} {{ $ar ? 'يوم' : 'days' }}, {{ $prediction->model_version }}, {{ $prediction->generated_at }}) @else — @endif
&nbsp; <strong>{{ $ar ? 'الشارات' : 'Badges' }}:</strong> {{ $badges->map(fn($b) => $ar ? $b->name_ar : $b->name_en)->join(', ') ?: '—' }}
</p>

<table class="rows">
<thead><tr><th>{{ $ar ? 'التاريخ' : 'Date' }}</th><th>{{ $ar ? 'الحضور' : 'Att.' }}</th><th>{{ $ar ? 'النوع' : 'Type' }}</th><th>{{ $ar ? 'المقطع' : 'Range' }}</th><th>{{ $ar ? 'الصفحات' : 'Pages' }}</th><th>E(s)</th><th>{{ $ar ? 'الأخطاء' : 'Errors' }}</th><th>{{ $ar ? 'المعلم' : 'Teacher' }}</th></tr></thead>
<tbody>
@foreach($sessions as $s)
<tr><td>{{ $s['session_date'] }}</td><td>{{ $s['attendance_status'] }}</td><td>{{ $s['session_type'] }}</td><td>{{ $s['range'] }}</td><td>{{ $s['pages_memorized'] }}</td><td>{{ $s['error_load'] }}</td>
<td>@foreach($s['errors'] as $e)<span class="tag">{{ $ar ? $e['label_ar'] : $e['label_en'] }} {{ $e['ayah_ref'] }}</span>@endforeach</td><td>{{ $s['teacher'] }}</td></tr>
@endforeach
</tbody></table>
<div class="footer">{{ $ar ? 'جميع الثوابت العددية مبدئية وتُعاير في CPIT-499.' : 'All numeric constants are provisional and calibrated in CPIT-499.' }} · d_max={{ $m['constants']['d_max'] }}, α={{ $m['constants']['alpha'] }}</div>
</body></html>
