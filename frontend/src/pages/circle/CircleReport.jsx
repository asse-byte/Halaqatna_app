import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { api, errMsg, openPdf } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnPrimary, inputCls, MetricCard, PageTitle, Table } from "../../components/ui-kit";

export default function CircleReport() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [circles, setCircles] = useState([]);
  const [circleId, setCircleId] = useState(actor.circle_id);
  const [rep, setRep] = useState(null);
  useEffect(() => { api.get("/circles").then((r) => { setCircles(r.data); if (!circleId && r.data[0]) setCircleId(r.data[0].circle_id); }); }, []);
  useEffect(() => { circleId && api.get(`/circles/${circleId}/report`).then((r) => setRep(r.data)); }, [circleId]);
  const s = rep?.summary;
  return (
    <div>
      <PageTitle title={t("report_title")} subtitle={rep ? `${rep.circle.name} · ${t("generated_at")} ${rep.generated_at}` : ""}>
        {actor.role === "SYS_ADMIN" && <select data-testid="report-circle-select" className={inputCls} value={circleId || ""} onChange={(e) => setCircleId(Number(e.target.value))}>{circles.map((c) => <option key={c.circle_id} value={c.circle_id}>{c.name}</option>)}</select>}
        <button data-testid="export-circle-pdf-button" className={btnPrimary} onClick={() => openPdf(`/circles/${circleId}/report.pdf`, locale).catch((e) => toast.error(errMsg(e)))}><FileDown size={16} />{t("export_pdf")}</button>
      </PageTitle>
      {s && <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard label={t("students")} value={s.students} testId="report-students" />
        <MetricCard label={t("sessions")} value={s.sessions} testId="report-sessions" delay={40} />
        <MetricCard label={t("pages")} value={s.total_pages} testId="report-pages" delay={80} />
        <MetricCard label={t("avg_mastery")} value={s.avg_mastery} testId="report-avg-mastery" delay={120} />
        <MetricCard label={t("avg_momentum")} value={s.avg_momentum} unit={t("pages_per_week")} testId="report-avg-momentum" delay={160} />
        <MetricCard label={t("avg_precision")} value={s.avg_precision} testId="report-avg-precision" delay={200} />
        <MetricCard label={t("avg_consistency")} value={s.avg_consistency} unit="%" testId="report-avg-consistency" delay={240} />
      </div>}
      <Table head={[t("student"), t("current_juz"), t("sessions"), t("pages"), t("mastery"), t("momentum"), t("precision"), t("consistency"), t("review_depth"), t("xp")]} testId="report-table">
        {rep?.students.map((r) => <tr key={r.student_id} data-testid={`report-row-${r.student_id}`} className="font-mono text-xs sm:text-sm"><td className="px-4 py-2 font-sans font-semibold"><Link to={`/staff/students/${r.student_id}`} className="hover:underline">{r.name}</Link></td><td className="px-4 py-2">{r.current_juz}</td><td className="px-4 py-2">{r.sessions_count}</td><td className="px-4 py-2">{r.total_pages}</td><td className="px-4 py-2">{r.mastery ?? "—"}</td><td className="px-4 py-2">{r.momentum}</td><td className="px-4 py-2">{r.precision ?? "—"}</td><td className="px-4 py-2">{r.consistency ?? "—"}</td><td className="px-4 py-2">{r.review_depth ?? "—"}</td><td className="px-4 py-2 text-gold font-semibold">{r.xp_total}</td></tr>)}
      </Table>
    </div>
  );
}
