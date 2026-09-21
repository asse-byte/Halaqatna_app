import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { PageTitle } from "../../components/ui-kit";

const CRITERIA = ["momentum", "precision", "consistency", "review_depth"];

/**
 * FR11 — four independent rankings, never combined.
 *
 * Each tab carries the line that explains what it ranks on, because the point of having
 * four is lost if a student cannot tell what they are being measured by: the one who is
 * slow but never absent tops attendance regularity, and the one who reviews thoroughly
 * tops review share, even when neither leads on pace.
 */
export default function Leaderboard() {
  const { t } = useT();
  const { actor } = useAuth();
  const [criterion, setCriterion] = useState("momentum");
  const [rows, setRows] = useState(null);
  const circleId = actor.circle_id;

  useEffect(() => {
    if (!circleId) return;
    setRows(null);
    api.get(`/circles/${circleId}/leaderboard`, { params: { criterion } }).then((r) => setRows(r.data.rows)).catch(() => setRows([]));
  }, [criterion, circleId]);

  const me = actor.type === "student" ? actor.student_id : null;
  const unit = { momentum: t("pages_per_week"), precision: "%", consistency: "%", review_depth: t("review_pages_unit") }[criterion];

  return (
    <div>
      <PageTitle title={t("leaderboard_title")} subtitle={t("leaderboard_note")} />

      <div className="mb-3 flex flex-wrap gap-2" role="tablist">
        {CRITERIA.map((c) => (
          <button key={c} role="tab" data-testid={`leaderboard-tab-${c}`} aria-selected={criterion === c} onClick={() => setCriterion(c)}
            className={`chip ${criterion === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-primary/10"}`}>
            {t(c)}
          </button>
        ))}
      </div>
      <p className="mb-5 max-w-2xl text-xs leading-relaxed text-muted-foreground" data-testid="criterion-hint">{t(`${criterion}_hint`)}</p>

      <div className="glass max-w-2xl divide-y divide-border/60 rounded-2xl" data-testid="leaderboard-list">
        {rows === null && <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>}
        {rows?.length === 0 && <div className="p-6 text-sm text-muted-foreground">{t("no_data")}</div>}
        {rows?.map((r, i) => (
          <div key={r.student_id} data-testid={`leaderboard-row-${r.rank}`} className={`flex items-center gap-4 px-4 py-3 animate-rise ${me === r.student_id ? "bg-gold/10" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono font-bold ${r.rank === 1 ? "bg-gold text-white" : r.rank <= 3 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {r.rank === 1 ? <Trophy size={16} /> : r.rank}
            </div>
            <div className="min-w-0 flex-1 truncate font-semibold">
              {r.name}{me === r.student_id && <span className="ms-2 text-xs text-gold">({t("you")})</span>}
            </div>
            <div className="shrink-0 font-mono text-lg font-semibold text-primary">
              {r.value}<span className="ms-1 text-xs font-sans text-muted-foreground">{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
