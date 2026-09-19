import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnGhost, MasteryGauge, MetricCard, PageTitle } from "../../components/ui-kit";

export function ForecastCard({ pred, onRefresh }) {
  const { t } = useT();
  const p = pred?.prediction;
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" data-testid="forecast-card">
      <div className="flex items-center justify-between"><div className="eyebrow">{t("forecast")}</div>{onRefresh && <button data-testid="refresh-forecast-button" className={`${btnGhost} !py-1 !px-2 text-xs`} onClick={onRefresh}><RefreshCw size={12} />{t("refresh_forecast")}</button>}</div>
      {!p ? <div className="mt-3 text-sm text-muted-foreground">{t("forecast_none")}</div> : <>
        <div className="mt-2 flex items-center gap-3"><CalendarClock className="text-secondary" /><div><div className="font-mono text-2xl font-semibold text-primary" dir="ltr" data-testid="forecast-date">{p.predicted_completion_date}</div><div className="text-xs text-muted-foreground">{t("forecast_eta", { days: p.eta_days })} · {t("model")} <span className="font-mono">{p.model_version}</span></div></div></div>
        {pred.stale && <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" data-testid="forecast-stale-notice"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{t("forecast_stale")} — <span className="font-mono" dir="ltr">{String(p.generated_at).replace("T", " ").slice(0, 16)}</span></div>}
      </>}
    </div>
  );
}

export function WeeklyChart({ weekly }) {
  const { t } = useT();
  const entries = Object.entries(weekly || {}).slice(-10);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" data-testid="weekly-chart">
      <div className="eyebrow mb-3">{t("weekly_pages")}</div>
      <div className="flex h-32 items-end gap-1.5" dir="ltr">
        {entries.map(([wk, v], i) => <div key={wk} className="group flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-md bg-secondary/80 transition-all group-hover:bg-gold" style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 4 : 1, animationDelay: `${i * 40}ms` }} title={`${wk}: ${v}`} /><span className="font-mono text-[9px] text-muted-foreground">{wk.slice(5)}</span></div>)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useT();
  const { actor } = useAuth();
  const [m, setM] = useState(null);
  const [pred, setPred] = useState(null);
  const id = actor.student_id;
  useEffect(() => { api.get(`/students/${id}/metrics`).then((r) => setM(r.data)); api.get(`/students/${id}/prediction`).then((r) => setPred(r.data)); }, [id]);
  if (!m) return <div className="text-muted-foreground">{t("loading")}</div>;
  return (
    <div data-testid="student-dashboard">
      <PageTitle title={`${t("welcome")}، ${actor.name}`} subtitle={`${actor.circle?.name || ""} · ${t("juz")} ${actor.current_juz}`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MasteryGauge value={m.mastery} />
        <MetricCard label={t("momentum")} value={m.momentum} unit={t("pages_per_week")} testId="momentum-card" delay={40} />
        <MetricCard label={t("precision")} value={m.precision} unit="%" testId="precision-card" delay={80} />
        <MetricCard label={t("consistency")} value={m.consistency} unit="%" testId="consistency-card" delay={120} />
        <MetricCard label={t("review_depth")} value={m.review_depth} unit="×" testId="review-depth-card" delay={160} />
        <MetricCard label={t("xp")} value={m.xp_total} accent testId="xp-card" delay={200} />
        <MetricCard label={t("total_pages")} value={m.total_pages} testId="total-pages-card" delay={240} />
        <MetricCard label={t("sessions")} value={m.sessions_count} testId="sessions-count-card" delay={280} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]"><ForecastCard pred={pred} /><WeeklyChart weekly={m.weekly_pages} /></div>
      <p className="mt-4 text-xs text-muted-foreground">{t("provisional")}: d_max={m.constants.d_max}, α={m.constants.alpha}</p>
    </div>
  );
}
