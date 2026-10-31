import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { api, errMsg, openPdf } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnPrimary, Dash, Figures, MetricCard, NewBadge, PageTitle, Table } from "../../components/ui-kit";

const TREND_TONE = {
  UP: "text-success",
  DOWN: "text-destructive",
  STEADY: "text-muted-foreground",
  NEW: "text-muted-foreground",
};

/** FR14 — the term report, with each column headed by the phrase that says what it counts. */
export default function CircleReport() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [rep, setRep] = useState(null);
  const circleId = actor.circle_id;

  useEffect(() => {
    if (!circleId) return;
    api.get(`/circles/${circleId}/report`).then((r) => setRep(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [circleId]);

  const s = rep?.summary;
  return (
    <div>
      <PageTitle title={t("report_title")} subtitle={rep ? `${rep.circle.name} · ${t("generated_at")} ${rep.generated_at}` : ""}>
        <button data-testid="export-circle-pdf-button" className={btnPrimary} onClick={() => openPdf(`/circles/${circleId}/report.pdf`, locale).catch((e) => toast.error(errMsg(e)))}>
          <FileDown size={16} />{t("export_pdf")}
        </button>
      </PageTitle>

      {s && (
        <Figures className="mb-8 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <MetricCard label={t("students")} value={s.students} testId="report-students" />
          <MetricCard label={t("sessions")} value={s.sessions} testId="report-sessions" />
          <MetricCard label={t("pages")} value={s.total_pages} testId="report-pages" />
          <MetricCard label={t("avg_mastery")} value={s.avg_mastery} unit="/100" hint={t("mastery_hint")} compact testId="report-avg-mastery" />
          <MetricCard label={t("avg_momentum")} value={s.avg_momentum} unit={t("pages_per_week")} hint={t("momentum_hint")} compact testId="report-avg-momentum" />
          <MetricCard label={t("avg_precision")} value={s.avg_precision} unit="%" hint={t("precision_hint")} compact testId="report-avg-precision" />
          <MetricCard label={t("avg_consistency")} value={s.avg_consistency} unit="%" hint={t("consistency_hint")} compact testId="report-avg-consistency" />
        </Figures>
      )}

      <Table
        head={[t("student"), t("current_juz"), t("sessions"), t("pages"), t("mastery"), t("momentum"), t("precision"), t("consistency"), t("review_depth"), t("trend")]}
        testId="report-table"
        empty={t("no_students_yet")}
      >
        {rep?.students.map((r) => {
          // A student with no recorded session has no figures yet: one "new" badge and a
          // quiet dash per column, rather than a row of zeros that reads as a bad term.
          const fresh = r.sessions_count === 0;
          const cell = (v, unit = "") => (fresh || v == null ? <Dash /> : `${v}${unit}`);
          return (
            <tr key={r.student_id} data-testid={`report-row-${r.student_id}`} className="text-xs sm:text-sm">
              <td className="px-4 py-2 font-semibold whitespace-nowrap">
                <Link to={`/staff/students/${r.student_id}`} className="hover:underline">{r.name}</Link>
                {fresh && <NewBadge testId={`report-new-${r.student_id}`} />}
              </td>
              <td className="px-4 py-2">{r.current_juz}</td>
              <td className="px-4 py-2">{cell(r.sessions_count)}</td>
              <td className="px-4 py-2">{cell(r.total_pages)}</td>
              <td className="px-4 py-2">{cell(r.mastery)}</td>
              <td className="px-4 py-2">{cell(r.momentum)}</td>
              <td className="px-4 py-2">{cell(r.precision, "%")}</td>
              <td className="px-4 py-2">{cell(r.consistency, "%")}</td>
              <td className="px-4 py-2">{cell(r.review_depth)}</td>
              <td className={`px-4 py-2 font-semibold ${TREND_TONE[r.trend]}`}>{fresh ? <Dash /> : t(`trend_${r.trend}`)}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
