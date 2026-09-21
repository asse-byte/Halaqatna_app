import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnGhost, MasteryGauge, MetricCard, PageTitle, TrendChart } from "../../components/ui-kit";
import { toast } from "sonner";

export function ForecastCard({ pred, onRefresh }) {
  const { t } = useT();
  const p = pred?.prediction;
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" data-testid="forecast-card">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">{t("forecast")}</div>
        {onRefresh && <button data-testid="refresh-forecast-button" className={`${btnGhost} !px-2 !py-1 text-xs`} onClick={onRefresh}><RefreshCw size={12} />{t("refresh_forecast")}</button>}
      </div>
      {!p ? (
        <div className="mt-3 text-sm text-muted-foreground">{t("forecast_none")}</div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            <CalendarClock className="shrink-0 text-secondary" />
            <div>
              {/* The model version and the generation timestamp are diagnostics for the
                  prediction service, not something a student or parent needs to read. */}
              <div className="font-mono text-2xl font-semibold text-primary" dir="ltr" data-testid="forecast-date">{p.predicted_completion_date}</div>
              <div className="text-xs text-muted-foreground">{t("forecast_eta", { days: p.eta_days })}</div>
            </div>
          </div>
          {pred.stale && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" data-testid="forecast-stale-notice">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />{t("forecast_stale")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
      <PageTitle title={`${t("welcome")}، ${actor.name}`} subtitle={`${actor.circle?.name || ""} · ${t("juz")} ${actor.current_juz}`} />

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
