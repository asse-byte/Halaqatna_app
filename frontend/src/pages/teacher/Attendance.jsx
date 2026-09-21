import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, Save } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { ATT_STYLES, btnGhost, btnPrimary, Field, inputCls, PageTitle } from "../../components/ui-kit";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Taking the register (FR4), on its own page.
 *
 * Attendance used to be the first field of the recitation form, which meant a teacher had
 * to open a full recitation screen to record that a student was absent. Here it is a
 * roll-call: pick the day, tap a status per student, save once.
 *
 * Three statuses, no more. "Late" was dropped because every teacher treated a late arrival
 * as present, and nothing in the system ever distinguished the two.
 */
const STATUSES = ["P", "A", "E"];

export default function Attendance() {
  const { t } = useT();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    api.get("/attendance", { params: { session_date: date } })
      .then((r) => setRows(r.data.rows))
      .catch((e) => toast.error(errMsg(e)));
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const set = (id, status) => setRows((xs) => xs.map((x) => (x.student_id === id ? { ...x, attendance_status: status } : x)));
  const markAllPresent = () => setRows((xs) => xs.map((x) => ({ ...x, attendance_status: x.attendance_status ?? "P" })));

  const save = async () => {
    const entries = rows.filter((r) => r.attendance_status).map((r) => ({ student_id: r.student_id, attendance_status: r.attendance_status }));
    if (!entries.length) return;
    setBusy(true);
    try {
      await api.post("/attendance", { session_date: date, entries });
      toast.success(t("attendance_saved"));
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto w-full max-w-2xl" data-testid="attendance-page">
      <PageTitle title={t("attendance_title")} subtitle={t("attendance_subtitle")} />

      <div className="glass mb-4 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <div className="flex-1 min-w-[12rem]">
          <Field label={t("session_date")}>
            <input data-testid="attendance-date" className={inputCls} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <button type="button" className={btnGhost} data-testid="mark-all-present" onClick={markAllPresent} disabled={!rows?.length}>
          <CheckCheck size={15} />{t("mark_all_present")}
        </button>
      </div>

      {rows === null && <div className="text-muted-foreground">{t("loading")}</div>}
      {rows?.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">{t("no_students_yet")}</div>}

      <div className="space-y-2">
        {rows?.map((r) => (
          <div key={r.student_id} data-testid={`attendance-row-${r.student_id}`} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.attendance_status ? t(`att_${r.attendance_status}`) : t("att_none")}
                {r.has_recitation && <span className="ms-2">· {t("has_recitation")}</span>}
              </div>
            </div>
            <div className="flex gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} type="button" data-testid={`att-${r.student_id}-${s}`} onClick={() => set(r.student_id, s)}
                  className={`chip border ${ATT_STYLES[s]} ${r.attendance_status === s ? "ring-2 ring-primary" : "opacity-60"}`}>
                  {t(`att_${s}`)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {rows?.length > 0 && (
        <div className="sticky bottom-20 mt-5 md:bottom-0 md:mt-6">
          <button className={`${btnPrimary} w-full py-3 shadow-xl`} data-testid="save-attendance" onClick={save} disabled={busy}>
            <Save size={16} />{busy ? t("saving") : t("save_attendance")}
          </button>
        </div>
      )}
    </div>
  );
}
