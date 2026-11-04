import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { BAND_FILL, Dash, Figures, MetricCard, NewBadge, PageTitle, Panel, Table } from "./ui-kit";
import { AttendanceChart, BandDistribution, ErrorDonut, Sparkline } from "./SummaryCharts";

const TREND_TONE = {
  UP: "text-success",
  DOWN: "text-destructive",
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

      <Figures className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard label={t("total_students")} value={k.students} testId="dash-students" />
        <MetricCard label={t("teachers_count")} value={k.teachers} testId="dash-teachers" />
        <MetricCard label={t("total_sessions")} value={k.sessions} testId="dash-sessions" />
        <MetricCard label={t("sessions_this_week")} value={k.sessions_this_week} testId="dash-week" />
        <MetricCard label={t("avg_mastery")} value={k.avg_mastery} unit="/100" hint={t("mastery_hint")} compact testId="dash-mastery" />
        <MetricCard label={t("avg_attendance")} value={k.avg_attendance} unit="%" testId="dash-attendance" />
      </Figures>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <AttendanceChart days={data.daily_attendance} weeks={data.weekly_attendance} />
        <ErrorDonut items={data.error_types} />
        <BandDistribution students={data.students} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={t("improving_students")} testId="improving-panel">
          {data.improving.length === 0
            ? <span className="text-sm text-muted-foreground">{t("no_data")}</span>
            : (
              <ul className="flex flex-wrap gap-2">
                {data.improving.map((n, i) => (
                  <li key={i} className="chip !min-h-0 border-border bg-background text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />{n}
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title={t("needs_attention")} hint={t("needs_attention_hint")} testId="attention-panel" bodyClassName="p-2">
          {data.needs_attention.length === 0
            ? <p className="px-3 py-2 text-sm text-muted-foreground">{t("all_good")}</p>
            : (
              <div className="divide-y divide-border/70">
                {data.needs_attention.map((s) => (
                  <Link key={s.student_id} to={`/staff/students/${s.student_id}`} data-testid={`attention-${s.student_id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                    <span className="font-semibold">{s.name}</span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className={`font-medium ${TREND_TONE[s.trend.direction]}`}>{t(`trend_${s.trend.direction}`)}</span>
                      <span className="text-muted-foreground">{t("consistency")} <span className="tabular-nums text-foreground">{s.consistency == null ? "—" : `${s.consistency}%`}</span></span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
        </Panel>
      </div>

      <h2 className="panel-title mb-3 mt-10">{t("students")}</h2>
      <Table
        head={[t("student"), t("current_juz"), t("mastery"), t("chart_level_short"), t("momentum"), t("consistency"), t("trend"), t("last_session"), ""]}
        testId="dashboard-students-table"
        empty={t("no_students_yet")}
      >
        {data.students.map((s) => {
          // Nothing recorded yet: the figures do not exist, so the row says "new" once and
          // leaves the rest blank instead of reading as a student who scored zero.
          const fresh = s.sessions_count === 0;
          return (
            <tr key={s.student_id} data-testid={`dash-row-${s.student_id}`} className={s.is_active ? "" : "opacity-50"}>
              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                <Link to={`/staff/students/${s.student_id}`} className="hover:underline">{s.name}</Link>
                {fresh && <NewBadge testId={`dash-new-${s.student_id}`} />}
                {!s.is_active && <span className="ms-2 text-[11px] text-muted-foreground">({t("suspended")})</span>}
              </td>
              <td className="px-4 py-3">{s.current_juz}</td>
              <td className="px-4 py-3">
                {fresh ? <Dash /> : (
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${BAND_FILL[s.band]}`} aria-hidden="true" />
                    {s.mastery != null && <span className="font-semibold tabular-nums">{s.mastery}</span>}
                    <span className="text-xs text-muted-foreground">{t(`band_${s.band}`)}</span>
                  </span>
                )}
              </td>
              <td className="px-4 py-3"><Sparkline points={s.session_levels} /></td>
              <td className="px-4 py-3 whitespace-nowrap">{fresh ? <Dash /> : <>{s.momentum} <span className="text-xs text-muted-foreground">{t("pages_per_week")}</span></>}</td>
              <td className="px-4 py-3">{s.consistency == null ? <Dash /> : `${s.consistency}%`}</td>
              <td className={`px-4 py-3 text-xs font-semibold ${TREND_TONE[s.trend.direction]}`}>{fresh ? <Dash /> : t(`trend_${s.trend.direction}`)}</td>
              <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground" dir="ltr">{s.last_session_date || <Dash />}</td>
              <td className="px-4 py-3 text-end">
                <Link to={`/staff/students/${s.student_id}`} className="whitespace-nowrap text-[13px] font-semibold text-primary underline-offset-4 hover:underline" data-testid={`dash-view-${s.student_id}`}>{t("view_performance")}</Link>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
