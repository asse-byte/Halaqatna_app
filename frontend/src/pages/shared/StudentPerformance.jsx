import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Copy, FileDown, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react";
import { api, errMsg, openPdf } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { ATT_STYLES, btnGhost, btnPrimary, ConfirmDialog, ErrorChip, Modal, PageTitle, Table, TrendChart } from "../../components/ui-kit";
import { MetricPanel } from "../../components/MetricPanel";
import { ForecastCard } from "../student/Dashboard";
import { SessionEditor } from "../../components/SessionEditor";
import { rangeLabel } from "../../lib/surahs";
import { fillTemplate, openWhatsApp, toWhatsAppNumber } from "../../lib/whatsapp";

const BAND = (v) => (v == null ? "NO_DATA" : v >= 90 ? "EXCELLENT" : v >= 75 ? "STRONG" : v >= 50 ? "DEVELOPING" : "NEEDS_WORK");

export default function StudentPerformance() {
  const { id } = useParams();
  const { t, locale } = useT();
  const { actor } = useAuth();
  const staff = actor.role !== "STUDENT";
  const [student, setStudent] = useState(null);
  const [m, setM] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [pred, setPred] = useState(null);
  const [share, setShare] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => Promise.all([
    api.get(`/students/${id}`), api.get(`/students/${id}/metrics`), api.get(`/students/${id}/sessions`),
    api.get(`/students/${id}/prediction`), staff ? api.get(`/students/${id}/share-link`) : Promise.resolve({ data: null }),
  ]).then(([s, mm, ss, p, sh]) => { setStudent(s.data); setM(mm.data); setSessions(ss.data); setPred(p.data); setShare(sh.data); })
    .catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [id]);

  const issueShare = () => api.post(`/students/${id}/share-link`).then((r) => { setShare(r.data); return r.data; });
  const revokeShare = () => api.delete(`/share-links/${share.link_id}`).then(() => { setShare(null); toast.success(t("share_revoked")); }).catch((e) => toast.error(errMsg(e)));
  const copyShare = () => navigator.clipboard?.writeText(share?.report_url || "").then(() => toast.success(t("copied")));

  /**
   * FR15 delivered the way a parent actually receives things: one tap opens WhatsApp on the
   * guardian's number with the message written and the report link in it. The teacher only
   * presses send. The link is created here if none is live, so the button works first time.
   */
  const sendWhatsApp = async () => {
    setSharing(true);
    try {
      const link = share ?? (await issueShare());
      const phone = link.guardian_phone || student.guardian_phone;
      if (!toWhatsAppNumber(phone)) { toast.error(t("share_no_phone")); return; }
      const message = fillTemplate(t("share_message"), {
        student: student.name, circle: student.circle?.name ?? "",
        juz: student.current_juz, band: t(`band_${BAND(m.mastery)}`),
        url: link.report_url,
      });
      openWhatsApp(phone, message);
    } catch (e) { toast.error(errMsg(e)); } finally { setSharing(false); }
  };

  const rotateCode = () => api.post(`/students/${id}/access-code`)
    .then((r) => { toast.success(t("code_regenerated")); setStudent({ ...student, ...r.data }); })
    .catch((e) => toast.error(errMsg(e)));

  const removeSession = (sid) => setConfirm({
    title: t("delete"), message: t("confirm_delete_session"),
    run: () => api.delete(`/sessions/${sid}`).then(() => { toast.success(t("deleted")); load(); }).catch((e) => toast.error(errMsg(e))),
  });

  /**
   * When the code is next due for rotation. The API computes it, but a code rotated during
   * this visit comes back from the rotate endpoint only, so the issue date is the fallback.
   */
  const rotationDue = useMemo(() => {
    if (!student?.access_code_issued_at) return null;
    const d = new Date(student.rotation_due_at || student.access_code_issued_at);
    if (!student.rotation_due_at) d.setDate(d.getDate() + 30);
    return { date: d.toISOString().slice(0, 10), overdue: d < new Date() };
  }, [student]);

  if (!student || !m) return <div className="text-muted-foreground">{t("loading")}</div>;

  return (
    <div>
      <PageTitle
        title={student.name}
        subtitle={[student.circle?.name, `${t("juz")} ${student.current_juz}`, student.teachers?.length ? `${t("teacher")}: ${student.teachers.map((x) => x.name).join("، ")}` : null]
          .filter(Boolean).join(" · ")}
      >
        <button data-testid="export-pdf-button" className={btnGhost} onClick={() => openPdf(`/students/${id}/report.pdf`, locale).catch((e) => toast.error(errMsg(e)))}>
          <FileDown size={16} />{t("export_pdf")}
        </button>
        {staff && (
          <button data-testid="share-whatsapp-button" className={btnPrimary} onClick={sendWhatsApp} disabled={sharing}>
            <Share2 size={16} />{sharing ? t("share_preparing") : t("share_whatsapp")}
          </button>
        )}
        {staff && <button data-testid="share-parents-button" className={btnGhost} onClick={() => setShareOpen(true)}>{t("share_parents")}</button>}
      </PageTitle>

      {staff && (
        <div className="glass mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-4 py-3 text-sm" data-testid="access-code-panel">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("access_code")}</span>
            <span className="font-mono text-lg font-bold tracking-[0.25em]" dir="ltr" data-testid="perf-access-code">{student.access_code}</span>
            <button data-testid="regenerate-code-button" className="text-muted-foreground transition-colors hover:text-primary" onClick={rotateCode} title={t("regenerate_code")}>
              <RefreshCw size={14} />
            </button>
          </div>
          {rotationDue && (
            <span className={`text-xs ${rotationDue.overdue ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} data-testid="code-rotation-due">
              {rotationDue.overdue ? t("access_code_renew_due") : `${t("access_code_valid_until")} ${rotationDue.date}`}
            </span>
          )}
          <span className="basis-full text-[11px] text-muted-foreground">{t("access_code_renew_hint")}</span>
        </div>
      )}

      <MetricPanel m={m} compact />

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.6fr]">
        <ForecastCard pred={pred} onRefresh={() => api.get(`/students/${id}/prediction`, { params: { refresh: 1 } }).then((r) => setPred(r.data))} />
        <TrendChart trend={m.trend} summary={m.trend_summary} />
      </div>

      <h2 className="eyebrow mb-2 mt-8">{t("history")}</h2>
      <Table
        head={[t("date"), t("attendance"), t("session_type"), t("range"), t("pages"), t("errors"), t("accuracy"), t("teacher"), ""]}
        testId="sessions-table"
        empty={t("no_sessions_yet")}
      >
        {sessions.map((s) => (
          <tr key={s.session_id} data-testid={`session-row-${s.session_id}`}>
            <td className="px-4 py-2 whitespace-nowrap text-xs" dir="ltr">{s.session_date}</td>
            <td className="px-4 py-2"><span className={`chip !min-h-0 ${ATT_STYLES[s.attendance_status]}`}>{t(`att_${s.attendance_status}`)}</span></td>
            {/* No passage recorded means nothing was recited — an absence, or an excused
                one. The type and the passage stay blank rather than repeating whatever
                the row happens to carry. */}
            <td className="px-4 py-2 text-xs">{s.surah_from ? t(`type_${s.session_type}`) : "—"}</td>
            <td className="px-4 py-2 text-xs">{s.surah_from ? rangeLabel(s, locale) : "—"}</td>
            <td className="px-4 py-2">{s.pages_memorized}</td>
            <td className="px-4 py-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">{s.error_count}</span>
                {s.errors.map((e) => <ErrorChip key={e.error_id} type={e.error_type} ayahRef={e.ayah_ref} testId={`session-error-${e.error_id}`} />)}
              </div>
            </td>
            <td className="px-4 py-2">{s.accuracy === null ? "—" : `${s.accuracy}%`}</td>
            <td className="px-4 py-2 text-xs text-muted-foreground">{s.teacher?.name ?? "—"}</td>
            <td className="px-4 py-2 text-end">
              {staff && (
                <div className="flex justify-end gap-1">
                  <button data-testid={`edit-session-${s.session_id}`} className={btnGhost} title={t("edit")} onClick={() => setEditing(s)}><Pencil size={14} /></button>
                  <button data-testid={`delete-session-${s.session_id}`} className={btnGhost} title={t("delete")} onClick={() => removeSession(s.session_id)}><Trash2 size={14} /></button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {editing && (
        <SessionEditor
          session={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast.success(t("session_updated")); load(); }}
        />
      )}

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title={t("share_parents")} subtitle={t("share_help")}>
        {!toWhatsAppNumber(student.guardian_phone) && (
          <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" data-testid="no-guardian-phone">
            {t("share_no_phone")}{" "}
            {actor.role === "CIRCLE_ADMIN" && <Link to="/circle/roster" className="font-semibold underline">{t("share_add_phone")}</Link>}
          </p>
        )}
        {share ? (
          <div className="space-y-3">
            <div className="glass flex items-center gap-2 rounded-xl px-3 py-2">
              <input readOnly dir="ltr" data-testid="share-url-input" className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" value={share.report_url} onFocus={(e) => e.target.select()} />
              <button data-testid="share-copy-button" className={btnGhost} onClick={copyShare} title={t("copy_link")}><Copy size={14} /></button>
            </div>
            <div className="text-xs text-muted-foreground">
              {t("expires")} <span dir="ltr">{String(share.expires_at).slice(0, 10)}</span>
              {share.view_count > 0 && <> · {t("views")}: {share.view_count}</>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <a href={share.report_url} target="_blank" rel="noreferrer" data-testid="share-open-link" className={btnGhost}>{t("open_link")}</a>
              <button data-testid="share-revoke-button" className={`${btnGhost} text-destructive`} onClick={revokeShare}>{t("revoke_link")}</button>
              <button data-testid="share-regenerate-button" className={btnGhost} onClick={() => issueShare().then(() => toast.success(t("share_created")))}>{t("new_link")}</button>
              <button data-testid="share-whatsapp-modal" className={btnPrimary} onClick={sendWhatsApp} disabled={sharing}><Share2 size={14} />{t("share_whatsapp")}</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button data-testid="share-create-button" className={btnGhost} onClick={() => issueShare().then(() => toast.success(t("share_created")))}>{t("create_link")}</button>
            <button data-testid="share-whatsapp-empty" className={btnPrimary} onClick={sendWhatsApp} disabled={sharing}><Share2 size={14} />{t("share_whatsapp")}</button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { confirm.run(); setConfirm(null); }}
      />
    </div>
  );
}
