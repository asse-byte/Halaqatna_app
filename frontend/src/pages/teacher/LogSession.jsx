import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CloudOff, Plus, Save } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { ATT_STYLES, btnGhost, btnPrimary, ERROR_STYLES, ErrorChip, Field, inputCls, PageTitle } from "../../components/ui-kit";
import { flushQueue, queueSession, readQueue } from "../../lib/offline";

const today = () => new Date().toISOString().slice(0, 10);

export default function LogSession() {
  const { t, locale } = useT();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [types, setTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(readQueue().length);
  const [f, setF] = useState({ student_id: params.get("student") || "", session_date: today(), attendance_status: "P", session_type: "NEW", surah_from: 1, ayah_from: 1, surah_to: 1, ayah_to: 7, pages_memorized: 1, errors: [] });
  const [ayahRef, setAyahRef] = useState("");

  useEffect(() => { Promise.all([api.get("/students"), api.get("/error-types")]).then(([s, e]) => { setStudents(s.data.filter((x) => x.is_active)); setTypes(e.data); if (!f.student_id && s.data[0]) set("student_id", s.data[0].student_id); }); }, []);
  useEffect(() => { const sync = () => flushQueue(api).then((n) => { setPending(readQueue().length); if (n) toast.success(`${t("synced")}: ${n}`); }); window.addEventListener("online", sync); sync(); return () => window.removeEventListener("online", sync); }, []);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const load = useMemo(() => f.errors.reduce((a, e) => a + Number(types.find((x) => x.error_type_id === e.error_type_id)?.weight || 0), 0), [f.errors, types]);
  const addError = (type) => setF((x) => ({ ...x, errors: [...x.errors, { error_type_id: type.error_type_id, ayah_ref: ayahRef || `${x.surah_from}:${x.ayah_from}` }] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, student_id: Number(f.student_id), client_uuid: crypto.randomUUID() };
    try {
      const { data } = await api.post("/sessions", body);
      toast.success(t("session_saved"));
      if (data.awards?.new_badges?.length) toast(`${t("new_badges")} ${data.awards.new_badges.map((b) => (locale === "ar" ? b.name_ar : b.name_en)).join("، ")}`);
      nav(`/staff/students/${body.student_id}`);
    } catch (err) {
      if (!err.response) { queueSession(body); setPending(readQueue().length); toast.warning(t("queued_offline")); nav("/teacher"); }
      else toast.error(errMsg(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden" data-testid="log-session-page">
      <PageTitle title={t("log_session_title")} />
      {pending > 0 && <div className="glass mb-4 flex items-center justify-between rounded-xl px-3 py-2 text-sm" data-testid="pending-sync-banner"><span className="flex items-center gap-2"><CloudOff size={14} />{pending} {t("pending_sync")}</span><button className={btnGhost} data-testid="sync-now-button" onClick={() => flushQueue(api).then(() => setPending(readQueue().length))}>{t("sync_now")}</button></div>}
      <form onSubmit={submit} className="space-y-5 pb-24" data-testid="session-form">
        <Field label={t("select_student")}><select data-testid="session-student-select" className={inputCls} value={f.student_id} onChange={(e) => set("student_id", e.target.value)} required>{students.map((s) => <option key={s.student_id} value={s.student_id}>{s.name}</option>)}</select></Field>
        <Field label={t("session_date")}><input data-testid="session-date-input" className={inputCls} type="date" value={f.session_date} onChange={(e) => set("session_date", e.target.value)} required /></Field>

        <div><div className="mb-1 text-xs font-semibold text-muted-foreground">{t("attendance")}</div>
          <div className="grid grid-cols-4 gap-2">{["P", "L", "E", "A"].map((a) => <button type="button" key={a} data-testid={`attendance-${a}`} onClick={() => set("attendance_status", a)} className={`chip justify-center border ${ATT_STYLES[a]} ${f.attendance_status === a ? "ring-2 ring-primary" : "opacity-70"}`}>{t(`att_${a}`)}</button>)}</div></div>

        <div><div className="mb-1 text-xs font-semibold text-muted-foreground">{t("session_type")}</div>
          <div className="grid grid-cols-3 gap-2">{["NEW", "REVIEW", "MIXED"].map((a) => <button type="button" key={a} data-testid={`session-type-${a}`} onClick={() => set("session_type", a)} className={`chip justify-center ${f.session_type === a ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{t(`type_${a}`)}</button>)}</div></div>

        <div><div className="mb-1 text-xs font-semibold text-muted-foreground">{t("range")}</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("surah_from")}><input data-testid="surah-from-input" className={inputCls} type="number" min={1} max={114} value={f.surah_from} onChange={(e) => set("surah_from", Number(e.target.value))} /></Field>
            <Field label={t("ayah_from")}><input data-testid="ayah-from-input" className={inputCls} type="number" min={1} max={286} value={f.ayah_from} onChange={(e) => set("ayah_from", Number(e.target.value))} /></Field>
            <Field label={t("surah_to")}><input data-testid="surah-to-input" className={inputCls} type="number" min={1} max={114} value={f.surah_to} onChange={(e) => set("surah_to", Number(e.target.value))} /></Field>
            <Field label={t("ayah_to")}><input data-testid="ayah-to-input" className={inputCls} type="number" min={1} max={286} value={f.ayah_to} onChange={(e) => set("ayah_to", Number(e.target.value))} /></Field>
          </div></div>

        <Field label={t("pages_memorized")}><input data-testid="pages-input" className={`${inputCls} font-mono text-lg`} type="number" step="0.25" min={0} max={99} value={f.pages_memorized} onChange={(e) => set("pages_memorized", e.target.value)} disabled={f.attendance_status === "A"} /></Field>

        <div className="glass rounded-2xl p-3" data-testid="error-tagging-panel">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{t("errors")} · {t("tap_to_tag")}</span><span className="font-mono text-xs" data-testid="weighted-load">E(s)={load.toFixed(2)}</span></div>
          <input data-testid="ayah-ref-input" className={`${inputCls} mb-2 font-mono`} dir="ltr" placeholder={`${t("ayah_ref")} ${f.surah_from}:${f.ayah_from}`} value={ayahRef} onChange={(e) => setAyahRef(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">{types.map((ty) => <button type="button" key={ty.code} data-testid={`error-tag-${ty.code}`} onClick={() => addError(ty)} className={`chip justify-between border ${ERROR_STYLES[ty.code]}`}><span>{locale === "ar" ? ty.label_ar : ty.label_en}</span><span className="font-mono text-[11px]"><Plus size={10} className="inline" />{Number(ty.weight).toFixed(2)}</span></button>)}</div>
          <div className="mt-3 flex flex-wrap gap-1.5" data-testid="tagged-errors">
            {f.errors.length === 0 && <span className="text-xs text-muted-foreground">{t("no_errors")}</span>}
            {f.errors.map((e, i) => <ErrorChip key={i} type={types.find((x) => x.error_type_id === e.error_type_id)} ayahRef={e.ayah_ref} testId={`tagged-error-${i}`} onRemove={() => set("errors", f.errors.filter((_, j) => j !== i))} />)}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-14 z-10 px-4 md:static md:px-0">
          <button data-testid="session-log-submit-button" className={`${btnPrimary} w-full shadow-xl py-3`} disabled={busy || !f.student_id}><Save size={16} />{busy ? t("saving") : t("save_session")}</button>
        </div>
      </form>
    </div>
  );
}
