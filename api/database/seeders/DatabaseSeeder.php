<?php

namespace Database\Seeders;

use App\Models\Badge;
use App\Models\Challenge;
use App\Models\Circle;
use App\Models\ErrorType;
use App\Models\RecitationSession;
use App\Models\Role;
use App\Models\SessionError;
use App\Models\StaffUser;
use App\Models\Student;
use App\Models\SystemSetting;
use App\Models\XpLedger;
use App\Services\AnalyticsEngine;
use App\Services\GamificationEngine;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Reference data (I1 seeders) — idempotent
        foreach ([['SYS_ADMIN', 'System Administrator'], ['CIRCLE_ADMIN', 'Circle Administrator'], ['TEACHER', 'Teacher']] as [$c, $l]) {
            Role::firstOrCreate(['code' => $c], ['label' => $l]);
        }
        foreach ([['MEM_GAP', 'نقص حفظ', 'Memory gap', 0.85], ['LNK_ERR', 'خطأ ربط', 'Linkage error', 0.50], ['TAJ_ERR', 'خطأ تجويد', 'Tajweed error', 0.25], ['SLF_CRT', 'تصحيح ذاتي', 'Self-correction', 0.05]] as [$c, $ar, $en, $w]) {
            ErrorType::firstOrCreate(['code' => $c], ['label_ar' => $ar, 'label_en' => $en, 'weight' => $w]);
        }
        foreach ([['d_max', '3.0', 'Mastery normalising constant (provisional)'], ['alpha', '0.4', 'Momentum EWMA smoothing factor (provisional)'],
            ['xp_per_page', '10', 'XP per page memorized'], ['xp_per_session', '5', 'XP per session attended']] as [$k, $v, $d]) {
            SystemSetting::firstOrCreate(['setting_key' => $k], ['setting_value' => $v, 'description' => $d]);
        }
        if (Badge::count() === 0) {
            Badge::insert([
                ['name_ar' => 'الصفحة الأولى', 'name_en' => 'First Page', 'condition_type' => 'PAGES_TOTAL', 'condition_value' => 1],
                ['name_ar' => 'حافظ الجزء', 'name_en' => 'Twenty Pages', 'condition_type' => 'PAGES_TOTAL', 'condition_value' => 20],
                ['name_ar' => 'المواظب', 'name_en' => 'Ten Sessions', 'condition_type' => 'SESSIONS_ATTENDED', 'condition_value' => 10],
                ['name_ar' => 'المتقن', 'name_en' => 'Mastery 90+', 'condition_type' => 'MASTERY_MIN', 'condition_value' => 90],
                ['name_ar' => 'سلسلة الحضور', 'name_en' => 'Five in a Row', 'condition_type' => 'STREAK_SESSIONS', 'condition_value' => 5],
                ['name_ar' => 'ألف نقطة', 'name_en' => '1000 XP', 'condition_type' => 'XP_TOTAL', 'condition_value' => 1000],
            ]);
        }
        if (Challenge::count() === 0) {
            Challenge::insert([
                ['title_ar' => 'عشر صفحات في أسبوعين', 'title_en' => 'Ten pages in two weeks', 'target_value' => 10, 'duration_days' => 14, 'xp_reward' => 150],
                ['title_ar' => 'خمس صفحات في أسبوع', 'title_en' => 'Five pages in a week', 'target_value' => 5, 'duration_days' => 7, 'xp_reward' => 60],
                ['title_ar' => 'مراجعة ثلاثين صفحة', 'title_en' => 'Review thirty pages this month', 'target_value' => 30, 'duration_days' => 30, 'xp_reward' => 300],
            ]);
        }

        // System administrator (real owner email) — idempotent
        $sysAdmin = StaffUser::updateOrCreate(['email' => env('SYS_ADMIN_EMAIL')], [
            'name' => 'Abdoul Malick Cisse', 'password_hash' => Hash::make(env('SYS_ADMIN_PASSWORD')),
            'role_id' => Role::where('code', 'SYS_ADMIN')->value('role_id'), 'circle_id' => null, 'locale' => 'en',
        ]);

        if (Circle::count() > 0) return; // demo data only once

        $c1 = Circle::create(['name' => 'حلقة الإمام نافع', 'location' => 'جامع الملك فهد – جدة', 'schedule_time' => '16:30']);
        $c2 = Circle::create(['name' => 'حلقة ابن كثير', 'location' => 'مسجد الرحمة – جدة', 'schedule_time' => '17:00']);

        $mk = fn ($name, $email, $role, $circle) => StaffUser::create(['name' => $name, 'email' => $email, 'password_hash' => Hash::make('Pass#2026'),
            'role_id' => Role::where('code', $role)->value('role_id'), 'circle_id' => $circle, 'locale' => 'ar']);
        $admin1 = $mk('منذر الفارسي', 'admin.nafi@halaqtna.sa', 'CIRCLE_ADMIN', $c1->circle_id);
        $admin2 = $mk('خالد العمري', 'admin.kathir@halaqtna.sa', 'CIRCLE_ADMIN', $c2->circle_id);
        $t1 = $mk('الشيخ أحمد الطيب', 'teacher.ahmad@halaqtna.sa', 'TEACHER', $c1->circle_id);
        $t2 = $mk('الشيخ يوسف الحربي', 'teacher.yousef@halaqtna.sa', 'TEACHER', $c1->circle_id);
        $t3 = $mk('الشيخ سعد القحطاني', 'teacher.saad@halaqtna.sa', 'TEACHER', $c2->circle_id);

        $names = ['عبدالله محمد', 'عمر خالد', 'يوسف أحمد', 'إبراهيم سعيد', 'حمزة فهد', 'سلمان ناصر', 'زياد عبدالعزيز', 'أنس طارق'];
        $codes = ['STU1AB2C', 'STU2CD3E', 'STU3EF4G', 'STU4GH5J', 'STU5JK6L', 'STU6LM7N', 'STU7NP8Q', 'STU8QR9S'];
        $profiles = [ // [pages/week, error rate, absence probability, review share]
            [3.5, 0.15, 0.05, 0.3], [2.0, 0.6, 0.10, 0.2], [4.5, 0.3, 0.0, 0.5], [1.5, 0.9, 0.30, 0.1],
            [2.5, 0.4, 0.05, 0.6], [3.0, 0.2, 0.15, 0.2], [1.0, 0.5, 0.0, 0.8], [3.8, 0.7, 0.20, 0.3],
        ];
        $errorTypes = ErrorType::all()->keyBy('code');
        $analytics = app(AnalyticsEngine::class);
        $g = app(GamificationEngine::class);
        mt_srand(499);

        foreach ($names as $i => $name) {
            $teacher = $i < 4 ? $t1 : $t2;
            $st = Student::create(['name' => $name, 'access_code' => $codes[$i], 'circle_id' => $c1->circle_id, 'current_juz' => 1 + ($i % 3), 'locale' => 'ar']);
            $st->teachers()->attach($teacher->user_id);
            [$ppw, $errRate, $absP, $reviewShare] = $profiles[$i];

            // ~6 weeks × 3 sessions (Sun/Tue/Thu)
            for ($w = 6; $w >= 0; $w--) {
                foreach ([0, 2, 4] as $dow) {
                    $date = Carbon::now()->startOfWeek(Carbon::SUNDAY)->subWeeks($w)->addDays($dow);
                    if ($date->isFuture()) continue;
                    $absent = mt_rand() / mt_getrandmax() < $absP;
                    $status = $absent ? 'A' : (mt_rand(0, 9) === 0 ? 'L' : 'P');
                    $isReview = mt_rand() / mt_getrandmax() < $reviewShare;
                    $pages = $absent ? 0 : round(max(0.25, $ppw / 3 + (mt_rand(-50, 50) / 100)), 2);
                    $surah = 78 + $i; $ayah = 1 + $w * 3;
                    $s = RecitationSession::create(['student_id' => $st->student_id, 'user_id' => $teacher->user_id, 'session_date' => $date->toDateString(),
                        'surah_from' => $surah, 'ayah_from' => $ayah, 'surah_to' => $surah, 'ayah_to' => $ayah + 8,
                        'pages_memorized' => $pages, 'attendance_status' => $status, 'session_type' => $isReview ? 'REVIEW' : 'NEW']);
                    if (!$absent) {
                        $n = (int) round($pages * $errRate * mt_rand(1, 3));
                        for ($k = 0; $k < $n; $k++) {
                            $pool = ['MEM_GAP', 'LNK_ERR', 'TAJ_ERR', 'TAJ_ERR', 'SLF_CRT', 'SLF_CRT'];
                            SessionError::create(['session_id' => $s->session_id, 'error_type_id' => $errorTypes[$pool[array_rand($pool)]]->error_type_id, 'ayah_ref' => "{$surah}:".($ayah + mt_rand(0, 8))]);
                        }
                        XpLedger::create(['student_id' => $st->student_id, 'session_id' => $s->session_id, 'points' => (int) round($pages * 10), 'reason' => 'PAGE_MEMORIZED', 'created_at' => $date]);
                        XpLedger::create(['student_id' => $st->student_id, 'session_id' => $s->session_id, 'points' => 5, 'reason' => 'SESSION_ATTENDED', 'created_at' => $date]);
                    }
                }
            }
            $g->evaluateBadges($st, $analytics->metrics($st));
            if ($i % 2 === 0) $st->challenges()->attach(1 + ($i % 3), ['status' => 'ACTIVE', 'progress' => mt_rand(0, 4), 'started_at' => now()->subDays(3)]);
        }

        // Second circle: two students so the RBAC exit test has data to be refused
        foreach ([['فيصل عادل', 'STU9ST2U'], ['ماجد وليد', 'STUAUV3W']] as [$n, $code]) {
            $st = Student::create(['name' => $n, 'access_code' => $code, 'circle_id' => $c2->circle_id, 'current_juz' => 1, 'locale' => 'ar']);
            $st->teachers()->attach($t3->user_id);
        }

        DB::table('audit_log')->insert(['actor_user_id' => $sysAdmin->user_id, 'action' => 'CREATE', 'entity' => 'seed', 'entity_id' => null,
            'payload_json' => json_encode(['event' => 'demo data seeded']), 'created_at' => now()]);
    }
}
