import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnGhost, btnPrimary, ConfirmDialog, Field, inputCls, Modal, PageTitle, Table } from "../../components/ui-kit";

/**
 * FR19 — the circle supervisors.
 *
 * These are the only people the System Administrator deals with. Teachers and students
 * belong to the supervisor of their circle (Table 1.1), and the API refuses this role a
 * sight of them, so there is nothing else to list here.
 */
export default function CircleAdmins() {
  const { t } = useT();
  const [staff, setStaff] = useState([]);
  const [circles, setCircles] = useState([]);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => Promise.all([api.get("/staff"), api.get("/circles")])
    .then(([s, c]) => { setStaff(s.data); setCircles(c.data); })
    .catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { name: form.name, email: form.email, phone: form.phone || null, address: form.address || null, circle_id: Number(form.circle_id) };
      if (form.password) body.password = form.password;
      if (form.user_id) await api.patch(`/staff/${form.user_id}`, body);
      else await api.post("/circle-admins", body);
      toast.success(t("saved")); setForm(null); load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const toggle = (u) => api.patch(`/staff/${u.user_id}`, { is_active: !u.is_active }).then(load).catch((e) => toast.error(errMsg(e)));
  const remove = (u) => setConfirm({
    message: `${t("confirm_delete_teacher")}\n\n${t("delete_blocked_hint")}`,
    run: () => api.delete(`/staff/${u.user_id}`).then(() => { toast.success(t("deleted")); load(); }).catch((e) => toast.error(errMsg(e))),
  });

  return (
    <div>
      <PageTitle title={t("circle_admins_title")} subtitle={t("circle_admins_subtitle")}>
        <button data-testid="new-circle-admin-button" className={btnPrimary} disabled={circles.length === 0}
          onClick={() => setForm({ name: "", email: "", password: "", phone: "", address: "", circle_id: circles[0]?.circle_id || "" })}>
          <Plus size={16} />{t("new_circle_admin")}
        </button>
      </PageTitle>

      <Table head={[t("name"), t("email"), t("phone"), t("circle"), t("status"), ""]} testId="staff-table" empty={t("no_data")}>
        {staff.map((u) => (
          <tr key={u.user_id} data-testid={`staff-row-${u.user_id}`}>
            <td className="px-4 py-3 font-semibold">{u.name}</td>
            <td className="px-4 py-3 text-xs" dir="ltr">{u.email}</td>
            <td className="px-4 py-3 text-xs" dir="ltr">{u.phone || "—"}</td>
            <td className="px-4 py-3">{u.circle_name}</td>
            <td className="px-4 py-3">
              <span className={`chip !min-h-0 ${u.is_active ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-red-300 text-red-700 dark:text-red-400"}`}>
                {u.is_active ? t("active") : t("suspended")}
              </span>
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <button data-testid={`edit-staff-${u.user_id}`} className={btnGhost} title={t("edit")} onClick={() => setForm({ ...u, password: "" })}><Pencil size={14} /></button>
                <button data-testid={`toggle-staff-${u.user_id}`} className={btnGhost} onClick={() => toggle(u)}>{u.is_active ? t("suspend") : t("reactivate")}</button>
                <button data-testid={`delete-staff-${u.user_id}`} className={btnGhost} title={t("delete")} onClick={() => remove(u)}><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal open={!!form} onClose={() => setForm(null)} wide title={form?.user_id ? t("edit") : t("new_circle_admin")}>
        {form && (
          <form onSubmit={save} className="space-y-3" data-testid="circle-admin-form">
            <Field label={t("full_name")}>
              <input data-testid="ca-name-input" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("email")}>
                <input data-testid="ca-email-input" className={inputCls} type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>
              <Field label={t("phone")}>
                <input data-testid="ca-phone-input" className={inputCls} type="tel" dir="ltr" placeholder="+9665…" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label={t("circle")}>
                <select data-testid="ca-circle-select" className={inputCls} value={form.circle_id} onChange={(e) => setForm({ ...form, circle_id: Number(e.target.value) })}>
                  {circles.map((c) => <option key={c.circle_id} value={c.circle_id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label={t("password")} hint={form.user_id ? t("password_optional_hint") : undefined}>
                <input data-testid="ca-password-input" className={inputCls} type="text" dir="ltr" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required={!form.user_id} minLength={form.password ? 6 : undefined} />
              </Field>
            </div>
            <Field label={t("address")}>
              <input data-testid="ca-address-input" className={inputCls} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setForm(null)}>{t("cancel")}</button>
              <button data-testid="ca-save-button" className={btnPrimary}>{t("save")}</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} title={t("delete")} message={confirm?.message}
        onCancel={() => setConfirm(null)} onConfirm={() => { confirm.run(); setConfirm(null); }} />
    </div>
  );
}
