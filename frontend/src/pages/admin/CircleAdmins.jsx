import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnGhost, btnPrimary, Field, inputCls, Modal, PageTitle, Table } from "../../components/ui-kit";

export default function CircleAdmins() {
  const { t } = useT();
  const [staff, setStaff] = useState([]);
  const [circles, setCircles] = useState([]);
  const [form, setForm] = useState(null);
  const load = () => Promise.all([api.get("/staff"), api.get("/circles")]).then(([s, c]) => { setStaff(s.data); setCircles(c.data); });
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try { await api.post("/circle-admins", form); toast.success(t("created")); setForm(null); load(); } catch (err) { toast.error(errMsg(err)); }
  };
  const toggle = async (u) => {
    try { await api.patch(`/staff/${u.user_id}`, { is_active: !u.is_active }); load(); } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div>
      <PageTitle title={t("circle_admins_title")}><button data-testid="new-circle-admin-button" className={btnPrimary} onClick={() => setForm({ name: "", email: "", password: "", circle_id: circles[0]?.circle_id || "" })}><Plus size={16} />{t("new_circle_admin")}</button></PageTitle>
      <Table head={[t("name"), t("email"), t("role_TEACHER") + " / " + t("role_CIRCLE_ADMIN"), t("circle"), t("status"), ""]} testId="staff-table">
        {staff.filter((u) => u.role !== "SYS_ADMIN").map((u) => <tr key={u.user_id} data-testid={`staff-row-${u.user_id}`}><td className="px-4 py-3 font-semibold">{u.name}</td><td className="px-4 py-3 font-mono text-xs" dir="ltr">{u.email}</td><td className="px-4 py-3">{t(`role_${u.role}`)}</td><td className="px-4 py-3">{u.circle_name}</td>
          <td className="px-4 py-3"><span className={`chip !min-h-0 ${u.is_active ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}`}>{u.is_active ? t("active") : t("suspended")}</span></td>
          <td className="px-4 py-3 text-end"><button data-testid={`toggle-staff-${u.user_id}`} className={btnGhost} onClick={() => toggle(u)}>{u.is_active ? t("suspend") : t("reactivate")}</button></td></tr>)}
      </Table>
      <Modal open={!!form} onClose={() => setForm(null)} title={t("new_circle_admin")}>
        {form && <form onSubmit={save} className="space-y-3">
          <Field label={t("name")}><input data-testid="ca-name-input" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label={t("email")}><input data-testid="ca-email-input" className={inputCls} type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label={t("password")}><input data-testid="ca-password-input" className={inputCls} type="text" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></Field>
          <Field label={t("circle")}><select data-testid="ca-circle-select" className={inputCls} value={form.circle_id} onChange={(e) => setForm({ ...form, circle_id: Number(e.target.value) })}>{circles.map((c) => <option key={c.circle_id} value={c.circle_id}>{c.name}</option>)}</select></Field>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className={btnGhost} onClick={() => setForm(null)}>{t("cancel")}</button><button data-testid="ca-save-button" className={btnPrimary}>{t("create")}</button></div>
        </form>}
      </Modal>
    </div>
  );
}
