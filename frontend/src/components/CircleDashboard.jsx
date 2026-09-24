import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { MetricCard, PageTitle, Table, btnGhost } from "./ui-kit";

const BAND_TONE = {
  EXCELLENT: "border-emerald-400/50 text-emerald-700 dark:text-emerald-400",
  STRONG: "border-emerald-400/40 text-emerald-700 dark:text-emerald-400",
  DEVELOPING: "border-amber-400/50 text-amber-700 dark:text-amber-400",
  NEEDS_WORK: "border-red-400/50 text-red-700 dark:text-red-400",
  NO_DATA: "border-border text-muted-foreground",
};
const TREND_TONE = {
  UP: "text-emerald-600 dark:text-emerald-400",
  DOWN: "text-red-600 dark:text-red-400",
  STEADY: "text-muted-foreground",
  NEW: "text-muted-foreground",
};

/**
 * The circle at a glance, shared by the Circle Supervisor and the Teacher.
 *
 * The API scopes the rows by who is asking (FR16): the Supervisor sees the whole circle,
 * a teacher sees only the students assigned to them. The same component renders both, so
 * the two roles read the same numbers and there is no second definition of "the circle".
 *
 * Nothing on this page is a formula. Each figure carries the phrase that says what it
 * counts, and the two lists at the top answer the question a register cannot: who is
 * climbing, and who needs following up this week.
 */
export function CircleDashboard({ title, subtitle }) {
  const { t } = useT();
  const { actor } = useAuth();
  const [data, setData] = useState(null);
  const circleId = actor.circle_id;

  useEffect(() => {
    if (!circleId) return setData({ empty: true });
    api.get(`/circles/${circleId}/dashboard`).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [circleId]);

  if (!data) return <div className="text-muted-foreground">{t("loading")}</div>;
  if (data.empty) return <div className="text-muted-foreground">{t("no_data")}</div>;

  const k = data.totals;
  return (
    <div data-testid="circle-dashboard">
      <PageTitle title={title} subtitle={subtitle || `${data.circle.name}${data.circle.location ? ` · ${data.circle.location}` : ""}`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label={t("total_students")} value={k.students} testId="dash-students" />
        <MetricCard label={t("teachers_count")} value={k.teachers} testId="dash-teachers" delay={40} />
        <MetricCard label={t("total_sessions")} value={k.sessions} testId="dash-sessions" delay={80} />
        <MetricCard label={t("sessions_this_week")} value={k.sessions_this_week} testId="dash-week" delay={120} />
        <MetricCard label={t("avg_mastery")} value={k.avg_mastery} unit="/100" hint={t("mastery_hint")} compact testId="dash-mastery" delay={160} />
        <MetricCard label={t("avg_attendance")} value={k.avg_attendance} unit="%" testId="dash-attendance" delay={200} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" data-testid="improving-panel">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" /><span className="eyebrow">{t("improving_students")}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.improving.length === 0
              ? <span className="text-sm text-muted-foreground">{t("no_data")}</span>
              : data.improving.map((n, i) => <span key={i} className="chip !min-h-0 border-emerald-400/50 text-emerald-700 dark:text-emerald-400">{n}</span>)}
          </div>
        </div>

        <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" style={{ animationDelay: "60ms" }} data-testid="attention-panel">
          <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" /><span className="eyebrow">{t("needs_attention")}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{t("needs_attention_hint")}</p>
          <div className="mt-3 space-y-1.5">
            {data.needs_attention.length === 0
              ? <span className="text-sm text-muted-foreground">{t("all_good")}</span>
              : data.needs_attention.map((s) => (
                <Link key={s.student_id} to={`/staff/students/${s.student_id}`} data-testid={`attention-${s.student_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-primary/5">
                  <span className="font-semibold">{s.name}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className={TREND_TONE[s.trend.direction]}>{t(`trend_${s.trend.direction}`)}</span>
                    <span className="text-muted-foreground">{t("consistency")} {s.consistency ?? "—"}%</span>
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </div>

      <h2 className="eyebrow mb-2 mt-8">{t("students")}</h2>
      <Table
        head={[t("student"), t("current_juz"), t("mastery"), t("momentum"), t("consistency"), t("trend"), t("last_session"), ""]}
        testId="dashboard-students-table"
        empty={t("no_students_yet")}
      >
        {data.students.map((s) => (
          <tr key={s.student_id} data-testid={`dash-row-${s.student_id}`} className={s.is_active ? "" : "opacity-50"}>
            <td className="px-4 py-3 font-semibold">
              <Link to={`/staff/students/${s.student_id}`} className="hover:underline">{s.name}</Link>
              {!s.is_active && <span className="ms-2 text-[11px] text-muted-foreground">({t("suspended")})</span>}
            </td>
            <td className="px-4 py-3">{s.current_juz}</td>
            <td className="px-4 py-3"><span className={`chip !min-h-0 ${BAND_TONE[s.band]}`}>{s.mastery ?? "—"} · {t(`band_${s.band}`)}</span></td>
            <td className="px-4 py-3">{s.momentum} <span className="text-xs text-muted-foreground">{t("pages_per_week")}</span></td>
            <td className="px-4 py-3">{s.consistency ?? "—"}%</td>
            <td className={`px-4 py-3 text-xs font-semibold ${TREND_TONE[s.trend.direction]}`}>{t(`trend_${s.trend.direction}`)}</td>
            <td className="px-4 py-3 text-xs text-muted-foreground" dir="ltr">{s.last_session_date || t("never")}</td>
            <td className="px-4 py-3 text-end">
              <Link to={`/staff/students/${s.student_id}`} className={btnGhost} data-testid={`dash-view-${s.student_id}`}>{t("view_performance")}</Link>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
