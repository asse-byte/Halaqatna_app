import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnGhost, PageTitle, Table } from "../../components/ui-kit";

export default function Audit() {
  const { t } = useT();
  const [page, setPage] = useState(null);
  const [p, setP] = useState(1);
  useEffect(() => { api.get("/audit", { params: { page: p } }).then((r) => setPage(r.data)); }, [p]);
  return (
    <div>
      <PageTitle title={t("audit_title")} subtitle={page ? `${page.total} rows` : ""} />
      <Table head={["#", t("audit_time"), t("audit_actor"), t("audit_action"), t("audit_entity"), t("audit_payload")]} testId="audit-table">
        {page?.data.map((r) => <tr key={r.log_id} data-testid={`audit-row-${r.log_id}`}><td className="px-4 py-2 font-mono text-xs">{r.log_id}</td><td className="px-4 py-2 font-mono text-xs whitespace-nowrap" dir="ltr">{r.created_at?.replace("T", " ").slice(0, 19)}</td><td className="px-4 py-2">{r.actor?.name || t("system")}</td>
          <td className="px-4 py-2"><span className="chip !min-h-0 border-border font-mono text-[11px]">{r.action}</span></td><td className="px-4 py-2 font-mono text-xs">{r.entity}{r.entity_id ? `#${r.entity_id}` : ""}</td>
          <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground max-w-md truncate" dir="ltr">{JSON.stringify(r.payload_json)}</td></tr>)}
      </Table>
      <div className="mt-4 flex justify-center gap-2">
        <button data-testid="audit-prev" className={btnGhost} disabled={p <= 1} onClick={() => setP(p - 1)}>‹</button>
        <span className="px-3 py-2 text-sm">{p} / {page?.last_page || 1}</span>
        <button data-testid="audit-next" className={btnGhost} disabled={!page || p >= page.last_page} onClick={() => setP(p + 1)}>›</button>
      </div>
    </div>
  );
}
