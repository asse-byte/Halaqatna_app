import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useT } from "../lib/i18n";
import { ATT_STYLES, btnGhost, btnPrimary, ErrorChip, Field, inputCls, Modal } from "./ui-kit";
import { ayahCount, surahName, SURAH_NUMBERS } from "../lib/surahs";

/**
 * Correcting a session that was typed wrongly.
 *
 * Everything entered by hand in this system can be put right: a page count, a date, the
 * Surah, the notes on the recitation. The correction is written to the audit trail, and the
 * encouragement points are settled with a compensating entry rather than by rewriting the
 * ledger, which stays append-only.
 */
export function SessionEditor({ session, onClose, onSaved }) {
  const { t, locale } = useT();
  const [types, setTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ayahRef, setAyahRef] = useState("");
  const [f, setF] = useState(() => ({
    session_date: String(session.session_date).slice(0, 10),
    // Legacy "late" rows are edited as present: the register no longer offers a fourth status.
    attendance_status: session.attendance_status === "L" ? "P" : session.attendance_status,
    session_type: session.session_type === "MIXED" ? "NEW" : session.session_type,
    surah_from: session.surah_from || 1, ayah_from: session.ayah_from || 1,
    surah_to: session.surah_to || session.surah_from || 1, ayah_to: session.ayah_to || 1,
    pages_memorized: session.pages_memorized,
    errors: (session.errors || []).map((e) => ({ error_type_id: e.error_type_id, ayah_ref: e.ayah_ref })),
  }));

  useEffect(() => { api.get("/error-types").then((r) => setTypes(r.data)).catch(() => {}); }, []);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pickSurah = (key, n) => setF((x) => {
    const next = { ...x, [key]: n };
    if (key === "surah_from") next.ayah_from = Math.min(x.ayah_from, ayahCount(n)) || 1;
    else next.ayah_to = Math.min(x.ayah_to, ayahCount(n)) || 1;
    if (key === "surah_from" && x.surah_to < n) { next.surah_to = n; next.ayah_to = Math.min(x.ayah_to, ayahCount(n)) || 1; }
    return next;
  });
  const surahOptions = useMemo(() => SURAH_NUMBERS.map((n) => [n, `${n}. ${surahName(n, locale)}`]), [locale]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.put(`/sessions/${session.session_id}`, f); onSaved(); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={t("edit_session_title")} wide>
      <form onSubmit={save} className="space-y-4" data-testid="session-editor">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("session_date")}>
            <input data-testid="edit-date" className={inputCls} type="date" value={f.session_date} onChange={(e) => set("session_date", e.target.value)} required />
          </Field>
          <Field label={t("pages_memorized")}>
            <input data-testid="edit-pages" className={inputCls} type="number" step="0.25" min={0} max={99} value={f.pages_memorized} onChange={(e) => set("pages_memorized", e.target.value)} required />
          </Field>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("attendance")}</div>
          <div className="grid grid-cols-3 gap-2">
            {["P", "A", "E"].map((a) => (
              <button type="button" key={a} data-testid={`edit-att-${a}`} onClick={() => set("attendance_status", a)}
                className={`chip justify-center border ${ATT_STYLES[a]} ${f.attendance_status === a ? "ring-2 ring-primary" : "opacity-60"}`}>{t(`att_${a}`)}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("session_type")}</div>
          <div className="grid grid-cols-2 gap-2">
            {["NEW", "REVIEW"].map((a) => (
              <button type="button" key={a} data-testid={`edit-type-${a}`} onClick={() => set("session_type", a)}
                className={`chip justify-center ${f.session_type === a ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{t(`type_${a}`)}</button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("surah_from")}>
            <select data-testid="edit-surah-from" className={inputCls} value={f.surah_from} onChange={(e) => pickSurah("surah_from", Number(e.target.value))}>
              {surahOptions.map(([n, label]) => <option key={n} value={n}>{label}</option>)}
            </select>
          </Field>
          <Field label={t("surah_to")}>
            <select data-testid="edit-surah-to" className={inputCls} value={f.surah_to} onChange={(e) => pickSurah("surah_to", Number(e.target.value))}>
              {surahOptions.filter(([n]) => n >= f.surah_from).map(([n, label]) => <option key={n} value={n}>{label}</option>)}
            </select>
          </Field>
          <Field label={t("ayah_from")} hint={t("ayah_max_hint", { n: ayahCount(f.surah_from) })}>
            <input data-testid="edit-ayah-from" className={inputCls} type="number" min={1} max={ayahCount(f.surah_from)} value={f.ayah_from} onChange={(e) => set("ayah_from", Number(e.target.value))} />
          </Field>
          <Field label={t("ayah_to")} hint={t("ayah_max_hint", { n: ayahCount(f.surah_to) })}>
            <input data-testid="edit-ayah-to" className={inputCls} type="number" min={1} max={ayahCount(f.surah_to)} value={f.ayah_to} onChange={(e) => set("ayah_to", Number(e.target.value))} />
          </Field>
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t("errors")}</span>
            <span className="text-xs text-muted-foreground">{t("errors_count", { n: f.errors.length })}</span>
          </div>
          <input className={`${inputCls} mb-2`} inputMode="numeric" placeholder={t("ayah_ref")} value={ayahRef} onChange={(e) => setAyahRef(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            {types.map((ty) => (
              <button type="button" key={ty.code} data-testid={`edit-error-${ty.code}`} className="chip justify-center border border-border"
                onClick={() => set("errors", [...f.errors, { error_type_id: ty.error_type_id, ayah_ref: ayahRef || String(f.ayah_from) }])}>
                {locale === "ar" ? ty.label_ar : ty.label_en}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {f.errors.length === 0 && <span className="text-xs text-muted-foreground">{t("no_errors")}</span>}
            {f.errors.map((e, i) => (
              <ErrorChip key={i} type={types.find((x) => x.error_type_id === e.error_type_id)} ayahRef={e.ayah_ref}
                onRemove={() => set("errors", f.errors.filter((_, j) => j !== i))} />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>{t("cancel")}</button>
          <button className={btnPrimary} data-testid="edit-session-save" disabled={busy}>{busy ? t("saving") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
