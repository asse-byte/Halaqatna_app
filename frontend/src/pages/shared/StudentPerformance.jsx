import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy, FileDown, RefreshCw, Share2, Trash2 } from "lucide-react";
import { api, errMsg, openPdf } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { ATT_STYLES, btnGhost, btnPrimary, ErrorChip, MasteryGauge, MetricCard, Modal, PageTitle, Table } from "../../components/ui-kit";
import { ForecastCard, WeeklyChart } from "../student/Dashboard";

export default function StudentPerformance() {
  const { id } = useParams();
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [student, setStudent] = useState(null);
  const [m, setM] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [pred, setPred] = useState(null);
  const [share, setShare] = useState(null); // {link_id, url, expires_at, view_count} | null
  const [shareOpen, setShareOpen] = useState(false);

  const load = () => Promise.all([api.get(`/students/${id}`), api.get(`/students/${id}/metrics`), api.get(`/students/${id}/sessions`), api.get(`/students/${id}/prediction`), actor.role !== "STUDENT" ? api.get(`/students/${id}/share-link`) : Promise.resolve({ data: null })])
    .then(([s, mm, ss, p, sh]) => { setStudent(s.data); setM(mm.data); setSessions(ss.data); setPred(p.data); setShare(sh.data); }).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [id]);

  // FR21 — the API returns the absolute /p/{token} URL; the token never reaches this component.
  const shareUrl = share?.url || "";
  const issueShare = () => api.post(`/students/${id}/share-link`).then((r) => { setShare(r.data); toast.success(t("share_created")); }).catch((e) => toast.error(errMsg(e)));
  const revokeShare = () => api.delete(`/share-links/${share.link_id}`).then(() => { setShare(null); toast.success(t("share_revoked")); }).catch((e) => toast.error(errMsg(e)));
  const copyShare = () => navigator.clipboard?.writeText(shareUrl).then(() => toast.success(t("copied")));

  const regen = () => api.post(`/students/${id}/access-code`).then((r) => { toast.success(t("code_regenerated")); setStudent({ ...student, access_code: r.data.access_code }); }).catch((e) => toast.error(errMsg(e)));
  const del = (sid) => window.confirm(t("confirm_delete_session")) && api.delete(`/sessions/${sid}`).then(load).catch((e) => toast.error(errMsg(e)));
  const refresh = () => api.get(`/students/${id}/prediction`, { params: { refresh: 1 } }).then((r) => setPred(r.data));

  if (!student || !m) return <div className="text-muted-foreground">{t("loading")}</div>;
  return (
    <div>
      <PageTitle title={student.name} subtitle={`${student.circle?.name} · ${t("juz")} ${student.current_juz} · ${t("teacher")}: ${student.teachers?.map((x) => x.name).join("، ")}`}>
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5"><span className="text-xs text-muted-foreground">{t("access_code")}</span><span className="font-mono tracking-widest font-semibold" dir="ltr" data-testid="perf-access-code">{student.access_code}</span>
          {actor.role !== "STUDENT" && <button data-testid="regenerate-code-button" className="text-muted-foreground hover:text-primary" onClick={regen} title={t("regenerate_code")}><RefreshCw size={14} /></button>}</div>
        <button data-testid="export-pdf-button" className={btnPrimary} onClick={() => openPdf(`/students/${id}/report.pdf`, locale).catch((e) => toast.error(errMsg(e)))}><FileDown size={16} />{t("export_pdf")}</button>
        {actor.role !== "STUDENT" && <button data-testid="share-parents-button" className={btnGhost} onClick={() => setShareOpen(true)}><Share2 size={16} />{t("share_parents")}</button>}
      </PageTitle>
      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title={t("share_parents")}>
        <p className="text-sm text-muted-foreground">{t("share_help")}</p>
        {share ? <div className="mt-4 space-y-3">
          <div className="glass flex items-center gap-2 rounded-xl px-3 py-2"><input readOnly dir="ltr" data-testid="share-url-input" className="flex-1 bg-transparent font-mono text-xs outline-none" value={shareUrl} onFocus={(e) => e.target.select()} /><button data-testid="share-copy-button" className={btnGhost} onClick={copyShare}><Copy size={14} /></button></div>
          <div className="text-xs text-muted-foreground">{t("expires")} {String(share.expires_at).slice(0, 10)}</div>
          <div className="flex flex-wrap justify-end gap-2"><a href={shareUrl} target="_blank" rel="noreferrer" data-testid="share-open-link" className={btnGhost}>{t("open_link")}</a><button data-testid="share-revoke-button" className={`${btnGhost} text-destructive`} onClick={revokeShare}>{t("revoke_link")}</button><button data-testid="share-regenerate-button" className={btnPrimary} onClick={issueShare}>{t("new_link")}</button></div>
        </div> : <div className="mt-4 flex justify-end"><button data-testid="share-create-button" className={btnPrimary} onClick={issueShare}><Share2 size={14} />{t("create_link")}</button></div>}
      </Modal>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MasteryGauge value={m.mastery} />
        <MetricCard label={t("momentum")} value={m.momentum} unit={t("pages_per_week")} testId="momentum-card" delay={40} />
        <MetricCard label={t("precision")} value={m.precision} unit="%" testId="precision-card" delay={80} />
        <MetricCard label={t("consistency")} value={m.consistency} unit="%" testId="consistency-card" delay={120} />
        <MetricCard label={t("review_depth")} value={m.review_depth} unit="×" testId="review-depth-card" delay={160} />
        <MetricCard label={t("xp")} value={m.xp_total} accent testId="xp-card" delay={200} />
        <MetricCard label={t("total_pages")} value={m.total_pages} testId="total-pages-card" delay={240} />
        <MetricCard label={t("attendance_rate")} value={Math.round(m.attendance_rate * 100)} unit="%" testId="attendance-card" delay={280} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <ForecastCard pred={pred} onRefresh={refresh} />
        <WeeklyChart weekly={m.weekly_pages} />
      </div>
      <h2 className="eyebrow mb-2 mt-8">{t("history")}</h2>
      <Table head={[t("date"), t("attendance"), t("session_type"), t("range"), t("pages"), "E(s)", t("errors"), ""]} testId="sessions-table">
        {sessions.map((s) => <tr key={s.session_id} data-testid={`session-row-${s.session_id}`}><td className="px-4 py-2 font-mono text-xs whitespace-nowrap" dir="ltr">{s.session_date}</td>
          <td className="px-4 py-2"><span className={`chip !min-h-0 ${ATT_STYLES[s.attendance_status]}`}>{t(`att_${s.attendance_status}`)}</span></td><td className="px-4 py-2 text-xs">{t(`type_${s.session_type}`)}</td>
          <td className="px-4 py-2 font-mono text-xs" dir="ltr">{s.surah_from}:{s.ayah_from} – {s.surah_to}:{s.ayah_to}</td><td className="px-4 py-2 font-mono">{s.pages_memorized}</td><td className="px-4 py-2 font-mono">{s.error_load}</td>
          <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{s.errors.map((e) => <ErrorChip key={e.error_id} type={e.error_type} ayahRef={e.ayah_ref} testId={`session-error-${e.error_id}`} />)}</div></td>
          <td className="px-4 py-2 text-end">{actor.role !== "STUDENT" && <button data-testid={`delete-session-${s.session_id}`} className={btnGhost} onClick={() => del(s.session_id)}><Trash2 size={14} /></button>}</td></tr>)}
      </Table>
    </div>
  );
}
