<?php

namespace App\Support;

/**
 * Every word that appears in a printed report, in both languages (NFR6).
 *
 * The vocabulary is deliberately plain. The analytics module names its outputs Mastery,
 * momentum, precision, consistency and review depth (FR7–FR9), and those names stay in the
 * API, in the database documentation and in the report, because that is what the design
 * calls them. They are not, however, what a parent or a twelve-year-old reads: "momentum"
 * told a teacher nothing until it was explained as pages per week.
 *
 * So each metric is printed under a phrase that says what it measures, with a one-line
 * explanation underneath. The number is unchanged; only the label is in the reader's words.
 */
final class ReportWords
{
    public const AR = [
        'app' => 'حلقتنا',
        'student_report' => 'تقرير أداء الطالب',
        'circle_report' => 'تقرير الحلقة',
        'student' => 'الطالب', 'circle' => 'الحلقة', 'teacher' => 'المعلم', 'teachers' => 'المعلمون',
        'juz' => 'الجزء الحالي', 'guardian' => 'جوال ولي الأمر', 'age' => 'العمر', 'year' => 'سنة',
        'generated' => 'تاريخ التقرير',

        'mastery' => 'مستوى الإتقان',
        'mastery_hint' => 'من 100 — كلما قلّت الأخطاء في كل صفحة ارتفع المستوى',
        'momentum' => 'سرعة الحفظ',
        'momentum_hint' => 'متوسط عدد الصفحات التي يحفظها الطالب في الأسبوع',
        'precision' => 'دقة التلاوة',
        'precision_hint' => 'نسبة الأخطاء البسيطة من مجموع الأخطاء — كلما ارتفعت قلّت الأخطاء الكبيرة',
        'consistency' => 'انتظام الحضور',
        'consistency_hint' => 'نسبة حضوره في آخر ثماني جلسات',
        'review_depth' => 'نصيب المراجعة',
        'review_depth_hint' => 'كم صفحة يراجعها مقابل كل صفحة جديدة يحفظها',
        'total_pages' => 'إجمالي الصفحات', 'sessions' => 'عدد الجلسات', 'attendance_rate' => 'نسبة الحضور',
        'errors_total' => 'مجموع الملاحظات',

        'forecast' => 'التاريخ المتوقع لإتمام الجزء',
        'forecast_none' => 'يحتاج إلى جلسات أكثر قبل إعطاء تاريخ متوقع',
        'days_left' => 'يتبقى تقريبًا {n} يومًا',
        'progress' => 'تطوّر المستوى أسبوعًا بأسبوع',
        'week' => 'الأسبوع', 'pages' => 'الصفحات', 'level' => 'المستوى',
        'trend' => 'الاتجاه العام',
        'trend_UP' => 'في تحسّن', 'trend_DOWN' => 'في تراجع', 'trend_STEADY' => 'مستقر', 'trend_NEW' => 'بداية جديدة',

        'history' => 'سجل الجلسات', 'date' => 'التاريخ', 'attendance' => 'الحضور',
        'type' => 'نوع الجلسة', 'range' => 'المقطع', 'errors' => 'الملاحظات', 'accuracy' => 'نسبة الإتقان',
        'att_P' => 'حاضر', 'att_A' => 'غائب', 'att_L' => 'حاضر', 'att_E' => 'معذور',
        'type_NEW' => 'حفظ جديد', 'type_REVIEW' => 'مراجعة', 'type_MIXED' => 'حفظ ومراجعة',
        'badges' => 'الأوسمة', 'none' => 'لا يوجد', 'no_sessions' => 'لا توجد جلسات مسجّلة بعد',

        'band_EXCELLENT' => 'ممتاز', 'band_STRONG' => 'جيد جدًا', 'band_DEVELOPING' => 'متوسط',
        'band_NEEDS_WORK' => 'يحتاج إلى مراجعة', 'band_NO_DATA' => 'لا توجد بيانات بعد',

        'students' => 'الطلاب', 'avg_mastery' => 'متوسط مستوى الإتقان', 'avg_momentum' => 'متوسط سرعة الحفظ',
        'avg_precision' => 'متوسط دقة التلاوة', 'avg_consistency' => 'متوسط انتظام الحضور',
        'footer_note' => 'أرقام هذا التقرير محسوبة من الجلسات المسجّلة في النظام. ثوابت الحساب مبدئية وتُعاير على بيانات حقيقية.',
    ];

    public const EN = [
        'app' => 'Halaqtna',
        'student_report' => 'Student performance report',
        'circle_report' => 'Circle report',
        'student' => 'Student', 'circle' => 'Circle', 'teacher' => 'Teacher', 'teachers' => 'Teachers',
        'juz' => 'Current Juz', 'guardian' => 'Guardian phone', 'age' => 'Age', 'year' => 'years',
        'generated' => 'Report date',

        'mastery' => 'Memorization quality',
        'mastery_hint' => 'Out of 100 — the fewer mistakes per page, the higher it climbs',
        'momentum' => 'Memorization pace',
        'momentum_hint' => 'Average pages the student memorizes in a week',
        'precision' => 'Recitation accuracy',
        'precision_hint' => 'Share of mistakes that were minor — higher means fewer serious ones',
        'consistency' => 'Attendance regularity',
        'consistency_hint' => 'How often the student attended the last eight sessions',
        'review_depth' => 'Review share',
        'review_depth_hint' => 'Pages reviewed for every new page memorized',
        'total_pages' => 'Total pages', 'sessions' => 'Sessions', 'attendance_rate' => 'Attendance rate',
        'errors_total' => 'Mistakes noted',

        'forecast' => 'Expected Juz completion date',
        'forecast_none' => 'More sessions are needed before a date can be estimated',
        'days_left' => 'About {n} days remaining',
        'progress' => 'Level week by week',
        'week' => 'Week', 'pages' => 'Pages', 'level' => 'Level',
        'trend' => 'Overall direction',
        'trend_UP' => 'Improving', 'trend_DOWN' => 'Slipping', 'trend_STEADY' => 'Steady', 'trend_NEW' => 'Just started',

        'history' => 'Session history', 'date' => 'Date', 'attendance' => 'Attendance',
        'type' => 'Session type', 'range' => 'Passage', 'errors' => 'Mistakes', 'accuracy' => 'Accuracy',
        'att_P' => 'Present', 'att_A' => 'Absent', 'att_L' => 'Present', 'att_E' => 'Excused',
        'type_NEW' => 'New memorization', 'type_REVIEW' => 'Review', 'type_MIXED' => 'New and review',
        'badges' => 'Badges', 'none' => 'None', 'no_sessions' => 'No sessions recorded yet',

        'band_EXCELLENT' => 'Excellent', 'band_STRONG' => 'Strong', 'band_DEVELOPING' => 'Fair',
        'band_NEEDS_WORK' => 'Needs review', 'band_NO_DATA' => 'No data yet',

        'students' => 'Students', 'avg_mastery' => 'Average memorization quality', 'avg_momentum' => 'Average pace',
        'avg_precision' => 'Average accuracy', 'avg_consistency' => 'Average attendance regularity',
        'footer_note' => 'Every figure here is computed from the sessions recorded in the system. The calculation constants are provisional and are calibrated against real data.',
    ];

    /** @return array<string,string> */
    public static function for(string $locale): array
    {
        return $locale === 'ar' ? self::AR : self::EN;
    }
}
