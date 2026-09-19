import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnGhost, btnPrimary, Field, inputCls, Modal, PageTitle, Table } from "../../components/ui-kit";

export default function Roster() {
  const { t } = useT();
  const { actor } = useAuth();
  const [circles, setCircles] = useState([]);
  const [circleId, setCircleId] = useState(actor.circle_id);
  const [roster, setRoster] = useState(null);
  const [form, setForm] = useState(null); // {kind:'teacher'|'student'|'assign', ...}

  useEffect(() => { api.get("/circles").then((r) => { setCircles(r.data); if (!circleId && r.data[0]) setCircleId(r.data[0].circle_id); }); }, []);
  const load = () => circleId && api.get(`/circles/${circleId}/roster`).then((r) => setRoster(r.data));
  useEffect(() => { load(); }, [circleId]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form.kind === "teacher") await api.post("/teachers", { ...form, circle_id: circleId });
      else if (form.kind === "student") await api.post("/students", { name: form.name, current_juz: Number(form.current_juz), circle_id: circleId, teacher_ids: form.teacher_ids });
      else await api.patch(`/students/${form.student_id}`, { teacher_ids: form.teacher_ids });
      toast.success(t("saved")); setForm(null); load();
    } catch (err) { toast.error(errMsg(err)); }
  };
  const toggleStaff = (u) => api.patch(`/staff/${u.user_id}`, { is_active: !u.is_active }).then(load).catch((err) => toast.error(errMsg(err)));
  const toggleStudent = (s) => api.patch(`/students/${s.student_id}`, { is_active: !s.is_active }).then(load).catch((err) => toast.error(errMsg(err)));
  const regen = (s) => api.post(`/students/${s.student_id}/access-code`).then(() => { toast.success(t("code_regenerated")); load(); }).catch((err) => toast.error(errMsg(err)));
  const toggleTeacherId = (id) => setForm({ ...form, teacher_ids: form.teacher_ids.includes(id) ? form.teacher_ids.filter((x) => x !== id) : [...form.teacher_ids, id] });

  return (
    <div>
      <PageTitle title={t("roster_title")} subtitle={roster?.circle?.name}>
        {actor.role === "SYS_ADMIN" && <select data-testid="roster-circle-select" className={inputCls} value={circleId || ""} onChange={(e) => setCircleId(Number(e.target.value))}>{circles.map((c) => <option key={c.circle_id} value={c.circle_id}>{c.name}</option>)}</select>}
        <button data-testid="new-teacher-button" className={btnGhost} onClick={() => setForm({ kind: "teacher", name: "", email: "", password: "" })}><Plus size={14} />{t("new_teacher")}</button>
        <button data-testid="new-student-button" className={btnPrimary} onClick={() => setForm({ kind: "student", name: "", current_juz: 1, teacher_ids: [] })}><Plus size={14} />{t("new_student")}</button>
      </PageTitle>

      <h2 className="eyebrow mb-2">{t("teachers")}</h2>
      <Table head={[t("name"), t("email"), t("status"), ""]} testId="teachers-table">
        {roster?.teachers.map((u) => <tr key={u.user_id} data-testid={`teacher-row-${u.user_id}`}><td className="px-4 py-3 font-semibold">{u.name}</td><td className="px-4 py-3 font-mono text-xs" dir="ltr">{u.email}</td>
          <td className="px-4 py-3"><span className={`chip !min-h-0 ${u.is_active ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}`}>{u.is_active ? t("active") : t("suspended")}</span></td>
          <td className="px-4 py-3 text-end"><button data-testid={`toggle-teacher-${u.user_id}`} className={btnGhost} onClick={() => toggleStaff(u)}>{u.is_active ? t("suspend") : t("reactivate")}</button></td></tr>)}
      </Table>

      <h2 className="eyebrow mb-2 mt-8">{t("students")}</h2>
      <Table head={[t("name"), t("current_juz"), t("access_code"), t("assigned_teachers"), t("status"), ""]} testId="students-table">
        {roster?.students.map((s) => <tr key={s.student_id} data-testid={`student-row-${s.student_id}`}><td className="px-4 py-3 font-semibold"><Link to={`/staff/students/${s.student_id}`} className="hover:underline" data-testid={`student-link-${s.student_id}`}>{s.name}</Link></td><td className="px-4 py-3">{s.current_juz}</td>
          <td className="px-4 py-3"><span className="font-mono tracking-widest" dir="ltr" data-testid={`student-code-${s.student_id}`}>{s.access_code}</span> <button className="ms-1 text-muted-foreground hover:text-primary" title={t("regenerate_code")} data-testid={`regen-code-${s.student_id}`} onClick={() => regen(s)}><RefreshCw size={13} className="inline" /></button></td>
          <td className="px-4 py-3 text-xs">{s.teachers.map((x) => x.name).join("، ") || "—"} <button className="ms-1 text-secondary hover:underline" data-testid={`reassign-${s.student_id}`} onClick={() => setForm({ kind: "assign", student_id: s.student_id, teacher_ids: s.teachers.map((x) => x.user_id) })}>{t("reassign")}</button></td>
          <td className="px-4 py-3"><span className={`chip !min-h-0 ${s.is_active ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}`}>{s.is_active ? t("active") : t("suspended")}</span></td>
          <td className="px-4 py-3 text-end"><button data-testid={`toggle-student-${s.student_id}`} className={btnGhost} onClick={() => toggleStudent(s)}>{s.is_active ? t("suspend") : t("reactivate")}</button></td></tr>)}
      </Table>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.kind === "teacher" ? t("new_teacher") : form?.kind === "student" ? t("new_student") : t("reassign")}>
        {form && <form onSubmit={submit} className="space-y-3">
          {form.kind !== "assign" && <Field label={t("name")}><input data-testid="form-name-input" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>}
          {form.kind === "teacher" && <><Field label={t("email")}><input data-testid="form-email-input" className={inputCls} type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label={t("password")}><input data-testid="form-password-input" className={inputCls} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></Field></>}
          {form.kind === "student" && <Field label={t("current_juz")}><input data-testid="form-juz-input" className={inputCls} type="number" min={1} max={30} value={form.current_juz} onChange={(e) => setForm({ ...form, current_juz: e.target.value })} /></Field>}
          {form.kind !== "teacher" && <div><div className="mb-1 text-xs font-semibold text-muted-foreground">{t("assigned_teachers")}</div><div className="flex flex-wrap gap-2">{roster?.teachers.map((u) => <button type="button" key={u.user_id} data-testid={`pick-teacher-${u.user_id}`} onClick={() => toggleTeacherId(u.user_id)} className={`chip !min-h-0 ${form.teacher_ids.includes(u.user_id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{u.name}</button>)}</div></div>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className={btnGhost} onClick={() => setForm(null)}>{t("cancel")}</button><button data-testid="form-save-button" className={btnPrimary}>{t("save")}</button></div>
        </form>}
      </Modal>
    </div>
  );
}
