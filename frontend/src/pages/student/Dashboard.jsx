import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { MasteryGauge, MetricCard, PageTitle, TrendChart } from "../../components/ui-kit";
import { ForecastCard } from "../../components/ForecastCard";

/**
 * The student's own page.
 *
 * It answers three questions a child actually asks — how am I doing, am I getting better,
 * and when will I finish — and nothing else. The normalising constants, the weighted error
 * load and the model version were removed: they are working parts of the Analytics Engine
 * and the prediction service, and printing them here only made the page harder to read.
 * The four ranking criteria of FR11 live on the recognition board, where they belong.
 */
export default function Dashboard() {
  const { t } = useT();
  const { actor } = useAuth();
  const [m, setM] = useState(null);
  const [pred, setPred] = useState(null);
  const id = actor.student_id;

  useEffect(() => {
    api.get(`/students/${id}/metrics`).then((r) => setM(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get(`/students/${id}/prediction`).then((r) => setPred(r.data)).catch(() => {});
  }, [id]);

  if (!m) return <div className="text-muted-foreground">{t("loading")}</div>;
  return (
    <div data-testid="student-dashboard">
      <PageTitle title={t("welcome", { name: actor.name })} subtitle={[actor.circle?.name, `${t("juz")} ${actor.current_juz}`].filter(Boolean).join(" · ")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><MasteryGauge value={m.mastery} /></div>
        <MetricCard label={t("momentum")} value={m.momentum} unit={t("pages_per_week")} hint={t("momentum_hint")} compact testId="momentum-card" delay={40} />
        <MetricCard label={t("consistency")} value={m.consistency} unit="%" hint={t("consistency_hint")} compact testId="consistency-card" delay={80} />
        <MetricCard label={t("total_pages")} value={m.total_pages} testId="total-pages-card" delay={120} />
        <MetricCard label={t("sessions")} value={m.sessions_count} testId="sessions-count-card" delay={160} />
        <MetricCard label={t("xp")} value={m.xp_total} accent testId="xp-card" delay={200} />
        <MetricCard label={t("attendance_rate")} value={Math.round((m.attendance_rate ?? 0) * 100)} unit="%" testId="attendance-card" delay={240} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.6fr]">
        <ForecastCard pred={pred} />
        <TrendChart trend={m.trend} summary={m.trend_summary} />
      </div>
    </div>
  );
}
