import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnGhost, btnPrimary, Field, inputCls, Modal, PageTitle, Table } from "../../components/ui-kit";

export default function Circles() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/circles").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = { name: edit.name, location: edit.location || null, schedule_time: edit.schedule_time ? edit.schedule_time.slice(0, 5) : null };
    try {
      if (edit.circle_id) await api.put(`/circles/${edit.circle_id}`, body); else await api.post("/circles", body);
      toast.success(t("saved")); setEdit(null); load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <div>
      <PageTitle title={t("circles_title")}><button data-testid="new-circle-button" className={btnPrimary} onClick={() => setEdit({ name: "", location: "", schedule_time: "" })}><Plus size={16} />{t("new_circle")}</button></PageTitle>
      <Table head={[t("name"), t("location"), t("schedule_time"), t("students"), t("staff"), ""]} testId="circles-table">
        {rows.map((c) => <tr key={c.circle_id} data-testid={`circle-row-${c.circle_id}`}><td className="px-4 py-3 font-semibold">{c.name}</td><td className="px-4 py-3 text-muted-foreground">{c.location}</td><td className="px-4 py-3 font-mono">{c.schedule_time?.slice(0, 5)}</td><td className="px-4 py-3">{c.students_count}</td><td className="px-4 py-3">{c.staff_count}</td>
          <td className="px-4 py-3 text-end"><button data-testid={`edit-circle-${c.circle_id}`} className={btnGhost} onClick={() => setEdit(c)}>{t("edit")}</button></td></tr>)}
      </Table>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.circle_id ? t("edit") : t("new_circle")}>
        {edit && <form onSubmit={save} className="space-y-3">
          <Field label={t("name")}><input data-testid="circle-name-input" className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
          <Field label={t("location")}><input data-testid="circle-location-input" className={inputCls} value={edit.location || ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
          <Field label={t("schedule_time")}><input data-testid="circle-time-input" className={inputCls} type="time" value={edit.schedule_time?.slice(0, 5) || ""} onChange={(e) => setEdit({ ...edit, schedule_time: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><button type="button" className={btnGhost} onClick={() => setEdit(null)}>{t("cancel")}</button><button data-testid="circle-save-button" className={btnPrimary}>{t("save")}</button></div>
        </form>}
      </Modal>
    </div>
  );
}
