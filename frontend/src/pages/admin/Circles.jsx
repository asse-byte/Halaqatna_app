import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnGhost, btnPrimary, ConfirmDialog, Field, inputCls, Modal, PageTitle, Table } from "../../components/ui-kit";

/**
 * FR19 — creating and configuring circles.
 *
 * The counts are the only thing this screen shows about what is inside a circle, and they
 * are here because the administrator needs them to decide whether a circle can be removed
 * or still needs a supervisor. Who those teachers and students are is not this role's
 * business (Table 1.1), and the API will not serve it to them.
 */
export default function Circles() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.get("/circles").then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = { name: edit.name, location: edit.location || null, schedule_time: edit.schedule_time ? edit.schedule_time.slice(0, 5) : null };
    try {
      if (edit.circle_id) await api.put(`/circles/${edit.circle_id}`, body);
      else await api.post("/circles", body);
      toast.success(t("saved")); setEdit(null); load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  const remove = (c) => setConfirm({
    message: `${t("confirm_delete_circle")}\n\n${c.name}`,
    run: () => api.delete(`/circles/${c.circle_id}`).then(() => { toast.success(t("deleted")); load(); }).catch((e) => toast.error(errMsg(e))),
  });

  return (
    <div>
      <PageTitle title={t("circles_title")} subtitle={t("circles_subtitle")}>
        <button data-testid="new-circle-button" className={btnPrimary} onClick={() => setEdit({ name: "", location: "", schedule_time: "" })}>
          <Plus size={16} />{t("new_circle")}
        </button>
      </PageTitle>

      <Table head={[t("name"), t("location"), t("schedule_time"), t("students"), t("staff"), ""]} testId="circles-table" empty={t("no_data")}>
        {rows.map((c) => (
          <tr key={c.circle_id} data-testid={`circle-row-${c.circle_id}`}>
            <td className="px-4 py-3 font-semibold">{c.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{c.location || "—"}</td>
            <td className="px-4 py-3 font-mono" dir="ltr">{c.schedule_time?.slice(0, 5) || "—"}</td>
            <td className="px-4 py-3">{c.students_count}</td>
            <td className="px-4 py-3">{c.staff_count}</td>
            <td className="px-4 py-3">
              <div className="flex justify-end gap-1">
                <button data-testid={`edit-circle-${c.circle_id}`} className={btnGhost} title={t("edit")} onClick={() => setEdit(c)}><Pencil size={14} /></button>
                <button data-testid={`delete-circle-${c.circle_id}`} className={btnGhost} title={t("delete")} onClick={() => remove(c)}><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.circle_id ? t("edit") : t("new_circle")}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <Field label={t("name")}>
              <input data-testid="circle-name-input" className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            </Field>
            <Field label={t("location")}>
              <input data-testid="circle-location-input" className={inputCls} value={edit.location || ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
            </Field>
            <Field label={t("schedule_time")}>
              <input data-testid="circle-time-input" className={inputCls} type="time" value={edit.schedule_time?.slice(0, 5) || ""} onChange={(e) => setEdit({ ...edit, schedule_time: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setEdit(null)}>{t("cancel")}</button>
              <button data-testid="circle-save-button" className={btnPrimary}>{t("save")}</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} title={t("delete")} message={confirm?.message}
        onCancel={() => setConfirm(null)} onConfirm={() => { confirm.run(); setConfirm(null); }} />
    </div>
  );
}
