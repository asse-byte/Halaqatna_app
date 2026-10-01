import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileDown, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react";
import { api, errMsg, openPdf } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { ATT_STYLES, btnGhost, btnPrimary, ConfirmDialog, ErrorChip, PageTitle, Table, TrendChart } from "../../components/ui-kit";
import { MetricPanel } from "../../components/MetricPanel";
import { ForecastCard } from "../../components/ForecastCard";
import { SessionEditor } from "../../components/SessionEditor";
import { toLocalDate } from "../../lib/dates";
import { bandFor } from "../../lib/mastery";
import { rangeLabel } from "../../lib/surahs";
import { fillTemplate, openWhatsApp, toWhatsAppNumber } from "../../lib/whatsapp";

export default function StudentPerformance() {
  const { id } = useParams();
  const { t, locale } = useT();
  const { actor } = useAuth();
  const staff = actor.role !== "STUDENT";
  const [student, setStudent] = useState(null);
  const [m, setM] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [pred, setPred] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => Promise.all([
    api.get(`/students/${id}`), api.get(`/students/${id}/metrics`), api.get(`/students/${id}/sessions`),
    api.get(`/students/${id}/prediction`),
  ]).then(([s, mm, ss, p]) => { setStudent(s.data); setM(mm.data); setSessions(ss.data); setPred(p.data); })
    .catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [id]);

  /**
   * FR15 delivered the way a parent actually receives things: one tap opens WhatsApp on the
   * guardian's number with the message written and the report link in it. The teacher only
   * presses send. This is the only way a report leaves the system for a guardian — there is
   * no separate panel for copying, opening or revoking the link.
   *
   * WhatsApp carries text only (`wa.me` cannot attach a file), so the message has to carry a
   * link to the PDF; the token behind it is the delivery, not something the teacher manages.
   *
   * Every send issues a fresh link, and issuing one retires the previous link (one live link
   * per student, §2.13). That is what keeps a link revocable now that no panel offers a
   * revoke button: a message sent to a wrong number stops working the moment the teacher
   * corrects the number and sends again. Links still expire after 30 days on their own.
   *
   * The number is checked before the link is issued, so a student with no guardian number on
   * file does not have their live link retired by a send that could never have gone out.
   */
  const sendWhatsApp = async () => {
    if (!toWhatsAppNumber(student.guardian_phone)) { toast.error(t("share_no_phone")); return; }
    setSharing(true);
    try {
      const { data: link } = await api.post(`/students/${id}/share-link`);
      const message = fillTemplate(t("share_message"), {
        student: student.name, circle: student.circle?.name ?? "",
        juz: student.current_juz, band: t(`band_${bandFor(m.mastery)}`),
        url: link.report_url,
      });
      openWhatsApp(link.guardian_phone || student.guardian_phone, message);
    } catch (e) { toast.error(errMsg(e)); } finally { setSharing(false); }
  };

  /** A new code signs the student out everywhere, so it is never one stray tap away. */
  const rotateCode = () => setConfirm({
    title: t("regenerate_code"), message: t("confirm_rotate_code"), confirmLabel: t("rotate_code"),
    run: () => api.post(`/students/${id}/access-code`)
      .then((r) => { toast.success(t("code_regenerated")); setStudent((s) => ({ ...s, ...r.data })); })
      .catch((e) => toast.error(errMsg(e))),
  });

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
    return { date: toLocalDate(d), overdue: d < new Date() };
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
        <ForecastCard pred={pred} onRefresh={() => api.get(`/students/${id}/prediction`, { params: { refresh: 1 } }).then((r) => setPred(r.data)).catch((e) => toast.error(errMsg(e)))} />
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

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { confirm.run(); setConfirm(null); }}
      />
    </div>
  );
}
