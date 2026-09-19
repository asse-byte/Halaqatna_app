import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnGhost, btnPrimary, Field, inputCls, Modal, PageTitle } from "../../components/ui-kit";

export default function MyStudents() {
  const { t } = useT();
  const { actor } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const load = () => api.get("/students").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const regen = (s) => api.post(`/students/${s.student_id}/access-code`).then(() => { toast.success(t("code_regenerated")); load(); }).catch((e) => toast.error(errMsg(e)));
  const create = async (e) => {
    e.preventDefault();
    try { await api.post("/students", { name: form.name, current_juz: Number(form.current_juz), circle_id: actor.circle_id }); toast.success(t("created")); setForm(null); load(); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <div>
      <PageTitle title={t("my_students")}>
        <Link to="/teacher/log" data-testid="go-log-session-button" className={btnGhost}><BookOpen size={16} />{t("log_session")}</Link>
        <button data-testid="teacher-new-student-button" className={btnPrimary} onClick={() => setForm({ name: "", current_juz: 1 })}><Plus size={16} />{t("new_student")}</button>
      </PageTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s, i) => <div key={s.student_id} data-testid={`student-card-${s.student_id}`} className="glass rounded-2xl p-4 animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="flex items-start justify-between gap-2"><div><div className="font-bold">{s.name}</div><div className="text-xs text-muted-foreground">{t("juz")} {s.current_juz} · {s.circle?.name}</div></div>
            {!s.is_active && <span className="chip !min-h-0 border-red-300 text-red-700 text-[11px]">{t("suspended")}</span>}</div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2"><span className="text-xs text-muted-foreground">{t("access_code")}</span><span className="font-mono tracking-widest font-semibold" dir="ltr" data-testid={`access-code-${s.student_id}`}>{s.access_code}</span>
            <button data-testid={`regenerate-code-${s.student_id}`} className="text-muted-foreground hover:text-primary" onClick={() => regen(s)} title={t("regenerate_code")}><RefreshCw size={14} /></button></div>
          <div className="mt-3 flex gap-2"><Link to={`/staff/students/${s.student_id}`} data-testid={`view-performance-${s.student_id}`} className={`${btnGhost} flex-1`}>{t("view_performance")}</Link><Link to={`/teacher/log?student=${s.student_id}`} data-testid={`log-for-${s.student_id}`} className={`${btnPrimary} flex-1`}>{t("log_session")}</Link></div>
        </div>)}
      </div>
      <Modal open={!!form} onClose={() => setForm(null)} title={t("new_student")}>
        {form && <form onSubmit={create} className="space-y-3">
          <Field label={t("name")}><input data-testid="ts-name-input" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label={t("current_juz")}><input data-testid="ts-juz-input" className={inputCls} type="number" min={1} max={30} value={form.current_juz} onChange={(e) => setForm({ ...form, current_juz: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className={btnGhost} onClick={() => setForm(null)}>{t("cancel")}</button><button data-testid="ts-save-button" className={btnPrimary}>{t("create")}</button></div>
        </form>}
      </Modal>
    </div>
  );
}
