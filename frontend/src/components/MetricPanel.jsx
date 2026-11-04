import { Figures, MasteryGauge, MetricCard, NewBadge } from "./ui-kit";
import { useT } from "../lib/i18n";

/**
 * The five measured qualities, in one place, with the same words everywhere.
 *
 * The analytics module still computes mastery, momentum, precision, consistency and review
 * depth exactly as the design specifies. What changed is what the screen prints: each one
 * appears under a phrase that says what it counts, with one line of explanation. Nothing
 * here shows a formula, a coefficient or an internal code — those belong to the service
 * that owns the calculation, not to a teacher mid-circle or to a child reading their page.
 */
export function MetricPanel({ m, children, compact = false }) {
  const { t } = useT();
  // Before the first session every figure here would read 0 — a pace of 0, 0 pages, 0%
  // attendance — which describes a student who failed, not one who has just joined.
  const fresh = m.sessions_count === 0;
  const v = (x) => (fresh ? null : x);
  return (
    <>
      {fresh && (
        <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.04] px-4 py-3 text-sm text-foreground/80" data-testid="new-student-notice">
          <NewBadge className="shrink-0" />
          <span>{t("new_student_notice")}</span>
        </div>
      )}
      <Figures className="grid-cols-2 lg:grid-cols-4">
        <MasteryGauge value={m.mastery} className="col-span-2" />
        <MetricCard label={t("momentum")} value={v(m.momentum)} unit={t("pages_per_week")} hint={t("momentum_hint")} compact={compact} testId="momentum-card" />
        <MetricCard label={t("precision")} value={v(m.precision)} unit="%" hint={t("precision_hint")} compact={compact} testId="precision-card" />
        <MetricCard label={t("consistency")} value={v(m.consistency)} unit="%" hint={t("consistency_hint")} compact={compact} testId="consistency-card" />
        <MetricCard label={t("review_depth")} value={v(m.review_depth)} unit={t("review_pages_unit")} hint={t("review_depth_hint")} compact={compact} testId="review-depth-card" />
        <MetricCard label={t("total_pages")} value={v(m.total_pages)} testId="total-pages-card" />
        <MetricCard label={t("attendance_rate")} value={fresh ? null : Math.round((m.attendance_rate ?? 0) * 100)} unit="%" testId="attendance-card" />
        {children}
      </Figures>
    </>
  );
}
