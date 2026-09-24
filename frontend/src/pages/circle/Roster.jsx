import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnGhost, btnPrimary, ConfirmDialog, Field, inputCls, Modal, PageTitle, Table } from "../../components/ui-kit";

const emptyTeacher = () => ({ kind: "teacher", name: "", email: "", password: "", phone: "", address: "" });
const emptyStudent = () => ({ kind: "student", name: "", guardian_phone: "", age: "", address: "", current_juz: 1, teacher_ids: [] });

/**
 * FR20 — the Circle Supervisor's roster.
 *
 * Registration captures the full record for each person, because a half-filled row is what
 * makes the rest of the system unusable later: a student with no guardian number cannot have
 * a report sent home, and a teacher with no phone cannot be reached about their circle.
 *
 * Every row here was typed by hand, so every row can be edited or removed. Deletion is
 * refused once sessions exist — that history is the evidence behind every figure the system
 * reports — and suspension is offered in its place.
 */
export default function Roster() {
  const { t } = useT();
  const { actor } = useAuth();
  const [roster, setRoster] = useState(null);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const circleId = actor.circle_id;

  const load = () => api.get(`/circles/${circleId}/roster`).then((r) => setRoster(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, [circleId]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form.kind === "teacher") {
        const body = { name: form.name, email: form.email, phone: form.phone || null, address: form.address || null, circle_id: circleId };
        if (form.password) body.password = form.password;
        if (form.user_id) await api.patch(`/staff/${form.user_id}`, body);
        else await api.post("/teachers", body);
      } else if (form.kind === "student") {
        const body = {
          name: form.name, guardian_phone: form.guardian_phone || null, address: form.address || null,
          age: form.age === "" ? null : Number(form.age), current_juz: Number(form.current_juz),
          circle_id: circleId, teacher_ids: form.teacher_ids,
        };
        if (form.student_id) await api.patch(`/students/${form.student_id}`, body);
        else await api.post("/students", body);
      } else {
        await api.patch(`/students/${form.student_id}`, { teacher_ids: form.teacher_ids });
      }
      toast.success(t("saved")); setForm(null); load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const patchStaff = (u, body) => api.patch(`/staff/${u.user_id}`, body).then(load).catch((e) => toast.error(errMsg(e)));
  const patchStudent = (s, body) => api.patch(`/students/${s.student_id}`, body).then(load).catch((e) => toast.error(errMsg(e)));
  /** A new code signs the student out everywhere, so it is never one stray tap away. */
  const rotateCode = (s) => setConfirm({
    title: t("regenerate_code"), message: `${t("confirm_rotate_code")}\n\n${s.name}`, confirmLabel: t("rotate_code"),
    run: () => api.post(`/students/${s.student_id}/access-code`).then(() => { toast.success(t("code_regenerated")); load(); }).catch((e) => toast.error(errMsg(e))),
  });

  const remove = (kind, row) => setConfirm({
    title: t("delete"),
    message: `${kind === "teacher" ? t("confirm_delete_teacher") : t("confirm_delete_student")}\n\n${t("delete_blocked_hint")}`,
    run: () => api.delete(kind === "teacher" ? `/staff/${row.user_id}` : `/students/${row.student_id}`)
      .then(() => { toast.success(t("deleted")); load(); })
      .catch((e) => toast.error(errMsg(e))),
  });

  const toggleTeacherId = (id) => setForm((f) => ({ ...f, teacher_ids: f.teacher_ids.includes(id) ? f.teacher_ids.filter((x) => x !== id) : [...f.teacher_ids, id] }));

  return (
    <div>
      <PageTitle title={t("roster_title")} subtitle={t("roster_subtitle")}>
        <button data-testid="new-teacher-button" className={btnGhost} onClick={() => setForm(emptyTeacher())}><Plus size={14} />{t("new_teacher")}</button>
        <button data-testid="new-student-button" className={btnPrimary} onClick={() => setForm(emptyStudent())}><Plus size={14} />{t("new_student")}</button>
      </PageTitle>

      <h2 className="eyebrow mb-2">{t("teachers")}</h2>
      <Table head={[t("name"), t("email"), t("phone"), t("status"), ""]} testId="teachers-table" empty={t("no_teachers_yet")}>
        {roster?.teachers.map((u) => (
          <tr key={u.user_id} data-testid={`teacher-row-${u.user_id}`}>
            <td className="px-4 py-3 font-semibold">{u.name}</td>
            <td className="px-4 py-3 text-xs" dir="ltr">{u.email}</td>
            <td className="px-4 py-3 text-xs" dir="ltr">{u.phone || "—"}</td>
            <td className="px-4 py-3"><span className={`chip !min-h-0 ${u.is_active ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-red-300 text-red-700 dark:text-red-400"}`}>{u.is_active ? t("active") : t("suspended")}</span></td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <button data-testid={`edit-teacher-${u.user_id}`} className={btnGhost} title={t("edit")} onClick={() => setForm({ kind: "teacher", ...u, password: "" })}><Pencil size={14} /></button>
                <button data-testid={`toggle-teacher-${u.user_id}`} className={btnGhost} onClick={() => patchStaff(u, { is_active: !u.is_active })}>{u.is_active ? t("suspend") : t("reactivate")}</button>
                <button data-testid={`delete-teacher-${u.user_id}`} className={btnGhost} title={t("delete")} onClick={() => remove("teacher", u)}><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="eyebrow mb-2 mt-8">{t("students")}</h2>
      <Table head={[t("name"), t("age"), t("guardian_phone"), t("current_juz"), t("access_code"), t("assigned_teachers"), t("status"), ""]} testId="students-table" empty={t("no_students_yet")}>
        {roster?.students.map((s) => (
          <tr key={s.student_id} data-testid={`student-row-${s.student_id}`}>
            <td className="px-4 py-3 font-semibold">
              <Link to={`/staff/students/${s.student_id}`} className="hover:underline" data-testid={`student-link-${s.student_id}`}>{s.name}</Link>
            </td>
            <td className="px-4 py-3">{s.age ?? "—"}</td>
            <td className="px-4 py-3 text-xs" dir="ltr">{s.guardian_phone || "—"}</td>
            <td className="px-4 py-3">{s.current_juz}</td>
            <td className="px-4 py-3">
              <span className="font-mono font-semibold tracking-widest" dir="ltr" data-testid={`student-code-${s.student_id}`}>{s.access_code}</span>
              <button className="ms-1 text-muted-foreground hover:text-primary" title={t("regenerate_code")} data-testid={`regen-code-${s.student_id}`} onClick={() => rotateCode(s)}><RefreshCw size={13} className="inline" /></button>
            </td>
            <td className="px-4 py-3 text-xs">
              {s.teachers.map((x) => x.name).join("، ") || "—"}
              <button className="ms-1 text-secondary hover:underline" data-testid={`reassign-${s.student_id}`} onClick={() => setForm({ kind: "assign", student_id: s.student_id, teacher_ids: s.teachers.map((x) => x.user_id) })}>{t("reassign")}</button>
            </td>
            <td className="px-4 py-3"><span className={`chip !min-h-0 ${s.is_active ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-red-300 text-red-700 dark:text-red-400"}`}>{s.is_active ? t("active") : t("suspended")}</span></td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <button data-testid={`edit-student-${s.student_id}`} className={btnGhost} title={t("edit")} onClick={() => setForm({ kind: "student", ...s, age: s.age ?? "", teacher_ids: s.teachers.map((x) => x.user_id) })}><Pencil size={14} /></button>
                <button data-testid={`toggle-student-${s.student_id}`} className={btnGhost} onClick={() => patchStudent(s, { is_active: !s.is_active })}>{s.is_active ? t("suspend") : t("reactivate")}</button>
                <button data-testid={`delete-student-${s.student_id}`} className={btnGhost} title={t("delete")} onClick={() => remove("student", s)}><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        wide
        title={form?.kind === "teacher" ? (form.user_id ? t("edit_teacher") : t("new_teacher"))
          : form?.kind === "student" ? (form.student_id ? t("edit_student") : t("new_student")) : t("reassign")}
      >
        {form && (
          <form onSubmit={submit} className="space-y-3" data-testid="roster-form">
            {form.kind !== "assign" && (
              <Field label={t("full_name")}>
                <input data-testid="form-name-input" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
            )}

            {form.kind === "teacher" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("email")}>
                  <input data-testid="form-email-input" className={inputCls} type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Field>
                <Field label={t("phone")}>
                  <input data-testid="form-phone-input" className={inputCls} type="tel" dir="ltr" placeholder="+9665…" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t("address")}>
                    <input data-testid="form-address-input" className={inputCls} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={t("password")} hint={form.user_id ? t("password_optional_hint") : undefined}>
                    <input data-testid="form-password-input" className={inputCls} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!form.user_id} minLength={form.password ? 8 : undefined} />
                  </Field>
                </div>
              </div>
            )}

            {form.kind === "student" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("guardian_phone")}>
                  <input data-testid="form-guardian-input" className={inputCls} type="tel" dir="ltr" placeholder="+9665…" value={form.guardian_phone || ""} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
                </Field>
                <Field label={t("age")}>
                  <input data-testid="form-age-input" className={inputCls} type="number" min={3} max={99} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                </Field>
                <Field label={t("current_juz")}>
                  <input data-testid="form-juz-input" className={inputCls} type="number" min={1} max={30} value={form.current_juz} onChange={(e) => setForm({ ...form, current_juz: e.target.value })} />
                </Field>
                <Field label={t("address")}>
                  <input data-testid="form-student-address" className={inputCls} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </Field>
              </div>
            )}

            {form.kind !== "teacher" && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("assigned_teachers")}</div>
                <div className="flex flex-wrap gap-2">
                  {roster?.teachers.length === 0 && <span className="text-xs text-muted-foreground">{t("no_teachers_yet")}</span>}
                  {roster?.teachers.map((u) => (
                    <button type="button" key={u.user_id} data-testid={`pick-teacher-${u.user_id}`} onClick={() => toggleTeacherId(u.user_id)}
                      className={`chip !min-h-0 ${form.teacher_ids.includes(u.user_id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{u.name}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setForm(null)}>{t("cancel")}</button>
              <button data-testid="form-save-button" className={btnPrimary}>{t("save")}</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message} confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)} onConfirm={() => { confirm.run(); setConfirm(null); }} />
    </div>
  );
}
