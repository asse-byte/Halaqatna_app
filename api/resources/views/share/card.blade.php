@php
    // FR21 / UC26 — public progress card. Every string exists in ar and en (NFR6).
    $rtl = $locale === 'ar';
    $s = [
        'ar' => [
            'app' => 'حلقتنا', 'title' => 'بطاقة التقدم الأسبوعي', 'juz' => 'الجزء الحالي',
            'pages' => 'الصفحات هذا الأسبوع', 'attendance' => 'الحضور هذا الأسبوع', 'mastery' => 'مستوى الإتقان',
            'eta' => 'التاريخ المتوقع لإتمام الجزء', 'eta_none' => 'غير متاح بعد',
            'of' => 'من', 'sessions' => 'جلسة',
            'footer' => 'بطاقة للاطّلاع فقط أصدرها معلّم الحلقة. لا تحتوي على ترتيب الطالب ولا تفاصيل الأخطاء.',
            'expires' => 'تنتهي صلاحية الرابط في', 'other_lang' => 'English',
            'bands' => ['EXCELLENT' => 'ممتاز', 'STRONG' => 'جيد جدًا', 'DEVELOPING' => 'في تحسّن', 'NEEDS_WORK' => 'يحتاج إلى مراجعة', 'NO_DATA' => 'لا توجد بيانات بعد'],
        ],
        'en' => [
            'app' => 'Halaqtna', 'title' => 'Weekly progress card', 'juz' => 'Current Juz',
            'pages' => 'Pages this week', 'attendance' => 'Attendance this week', 'mastery' => 'Mastery',
            'eta' => 'Expected Juz completion', 'eta_none' => 'Not available yet',
            'of' => 'of', 'sessions' => 'sessions',
            'footer' => 'Read-only card issued by the circle teacher. It carries no ranking and no error detail.',
            'expires' => 'Link expires on', 'other_lang' => 'العربية',
            'bands' => ['EXCELLENT' => 'Excellent', 'STRONG' => 'Strong', 'DEVELOPING' => 'Developing', 'NEEDS_WORK' => 'Needs review', 'NO_DATA' => 'No data yet'],
        ],
    ][$locale];
    $bandTone = ['EXCELLENT' => '#0f7b6c', 'STRONG' => '#2f6f4f', 'DEVELOPING' => '#8a6d1f', 'NEEDS_WORK' => '#9a4b2f', 'NO_DATA' => '#5b6472'][$card['mastery_band']];
@endphp
<!doctype html>
<html lang="{{ $locale }}" dir="{{ $rtl ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {{-- §2.13 — the page must never be indexed. Sent as a header too. --}}
    <meta name="robots" content="noindex, nofollow, noarchive">
    <meta name="referrer" content="no-referrer">
    <title>{{ $s['title'] }} · {{ $s['app'] }}</title>
    <style>
        :root { --ink:#14201c; --muted:#5b6472; --line:#e4e7e4; --bg:#f6f7f5; --card:#fff; --brand:#14563f; }
        * { box-sizing:border-box; }
        body { margin:0; padding:24px 16px; background:var(--bg); color:var(--ink);
               font-family:{{ $rtl ? "'Segoe UI','Tahoma'" : "'Segoe UI',system-ui" }},-apple-system,Roboto,Arial,sans-serif; }
        .wrap { max-width:520px; margin:0 auto; }
        .head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        .brand { display:flex; align-items:center; gap:8px; font-weight:700; color:var(--brand); }
        .mark { width:34px; height:34px; border-radius:10px; background:var(--brand); color:#fff;
                display:grid; place-items:center; font-size:18px; }
        .lang { font-size:13px; color:var(--brand); text-decoration:none; border:1px solid var(--line);
                background:var(--card); border-radius:999px; padding:6px 12px; }
        .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px; }
        h1 { margin:0 0 2px; font-size:24px; }
        .eyebrow { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
        .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:18px; }
        .cell { border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
        .cell .k { font-size:12px; color:var(--muted); }
        .cell .v { font-size:22px; font-weight:700; margin-top:4px; }
        .cell .v small { font-size:13px; font-weight:500; color:var(--muted); }
        .band { display:inline-block; margin-top:4px; padding:4px 12px; border-radius:999px;
                font-size:15px; font-weight:700; color:#fff; background:{{ $bandTone }}; }
        .eta { margin-top:12px; border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
        .eta .v { font-size:19px; font-weight:700; font-variant-numeric:tabular-nums; }
        .foot { margin-top:18px; font-size:12px; line-height:1.6; color:var(--muted); text-align:center; }
        @media (max-width:360px) { .grid { grid-template-columns:1fr; } body { padding:16px 12px; } }
    </style>
</head>
<body>
<div class="wrap">
    <div class="head">
        <div class="brand"><span class="mark">ح</span><span>{{ $s['app'] }}</span></div>
        <a class="lang" href="?lang={{ $locale === 'ar' ? 'en' : 'ar' }}">{{ $s['other_lang'] }}</a>
    </div>

    <div class="card">
        <div class="eyebrow">{{ $s['title'] }}</div>
        <h1 data-testid="share-first-name">{{ $card['first_name'] }}</h1>

        <div class="grid">
            <div class="cell">
                <div class="k">{{ $s['pages'] }}</div>
                <div class="v" data-testid="share-pages-week">{{ $card['pages_this_week'] }}</div>
            </div>
            <div class="cell">
                <div class="k">{{ $s['attendance'] }}</div>
                <div class="v" data-testid="share-attendance">
                    {{ $card['attended_this_week'] }} <small>{{ $s['of'] }} {{ $card['sessions_this_week'] }} {{ $s['sessions'] }}</small>
                </div>
            </div>
            <div class="cell">
                <div class="k">{{ $s['juz'] }}</div>
                <div class="v" data-testid="share-juz">{{ $card['current_juz'] }}</div>
            </div>
            <div class="cell">
                <div class="k">{{ $s['mastery'] }}</div>
                {{-- Band only — the raw mastery score is never published here (§2.13). --}}
                <div class="band" data-testid="share-mastery-band">{{ $s['bands'][$card['mastery_band']] }}</div>
            </div>
        </div>

        <div class="eta">
            <div class="k" style="font-size:12px;color:var(--muted)">{{ $s['eta'] }}</div>
            <div class="v" dir="ltr" data-testid="share-eta">{{ $card['predicted_completion_date'] ?? $s['eta_none'] }}</div>
        </div>
    </div>

    <p class="foot">
        {{ $s['footer'] }}<br>
        {{ $s['expires'] }} <span dir="ltr">{{ \Illuminate\Support\Carbon::parse($expires_at)->toDateString() }}</span>
    </p>
</div>
</body>
</html>
