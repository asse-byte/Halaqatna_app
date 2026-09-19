<!DOCTYPE html>
<html dir="{{ $locale === 'ar' ? 'rtl' : 'ltr' }}">
<head><meta charset="utf-8">
<style>
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; }
  h1 { color: #0F382C; font-size: 20px; margin: 0 0 4px; }
  .muted { color: #6b7280; }
  .grid { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .grid td { border: 1px solid #e5e7eb; padding: 6px; text-align: center; }
  .grid .v { font-size: 18px; font-weight: bold; color: #0F382C; }
  table.rows { width: 100%; border-collapse: collapse; }
  table.rows th { background: #0F382C; color: #fff; padding: 5px; font-size: 10px; }
  table.rows td { border-bottom: 1px solid #e5e7eb; padding: 4px 5px; text-align: center; }
</style></head>
<body>
@php $ar = $locale === 'ar'; $s = $summary; @endphp
<h1>{{ $ar ? 'حلقتنا — تقرير الفصل للحلقة' : 'Halaqtna — Circle Term Report' }}</h1>
<div class="muted">{{ $circle->name }} · {{ $circle->location }} · {{ $generated_at }}</div>
<table class="grid"><tr>
  <td><div class="v">{{ $s['students'] }}</div>{{ $ar ? 'الطلاب' : 'Students' }}</td>
  <td><div class="v">{{ $s['sessions'] }}</div>{{ $ar ? 'الجلسات' : 'Sessions' }}</td>
  <td><div class="v">{{ $s['total_pages'] }}</div>{{ $ar ? 'الصفحات' : 'Pages' }}</td>
  <td><div class="v">{{ $s['avg_mastery'] }}</div>{{ $ar ? 'متوسط الإتقان' : 'Avg mastery' }}</td>
  <td><div class="v">{{ $s['avg_momentum'] }}</div>{{ $ar ? 'متوسط الزخم' : 'Avg momentum' }}</td>
  <td><div class="v">{{ $s['avg_precision'] }}</div>{{ $ar ? 'متوسط الدقة' : 'Avg precision' }}</td>
  <td><div class="v">{{ $s['avg_consistency'] }}</div>{{ $ar ? 'متوسط الانتظام' : 'Avg consistency' }}</td>
</tr></table>
<table class="rows">
<thead><tr><th>{{ $ar ? 'الطالب' : 'Student' }}</th><th>{{ $ar ? 'الجزء' : 'Juz' }}</th><th>{{ $ar ? 'الجلسات' : 'Sessions' }}</th><th>{{ $ar ? 'الصفحات' : 'Pages' }}</th><th>{{ $ar ? 'الإتقان' : 'Mastery' }}</th><th>{{ $ar ? 'الزخم' : 'Momentum' }}</th><th>{{ $ar ? 'الدقة' : 'Precision' }}</th><th>{{ $ar ? 'الانتظام' : 'Consistency' }}</th><th>{{ $ar ? 'عمق المراجعة' : 'Review depth' }}</th><th>XP</th></tr></thead>
<tbody>
@foreach($students as $st)
<tr><td>{{ $st['name'] }}</td><td>{{ $st['current_juz'] }}</td><td>{{ $st['sessions_count'] }}</td><td>{{ $st['total_pages'] }}</td><td>{{ $st['mastery'] ?? '—' }}</td><td>{{ $st['momentum'] }}</td><td>{{ $st['precision'] ?? '—' }}</td><td>{{ $st['consistency'] ?? '—' }}</td><td>{{ $st['review_depth'] ?? '—' }}</td><td>{{ $st['xp_total'] }}</td></tr>
@endforeach
</tbody></table>
</body></html>
