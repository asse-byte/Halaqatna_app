import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { PageTitle } from "../../components/ui-kit";
import { StarMark } from "../../components/Brand";

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

      <div className="mb-3 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_hsl(var(--border))]" role="tablist">
        {CRITERIA.map((c) => (
          <button key={c} role="tab" data-testid={`leaderboard-tab-${c}`} aria-selected={criterion === c} onClick={() => setCriterion(c)}
            className={`min-h-[44px] whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 ${criterion === c ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t(c)}
          </button>
        ))}
      </div>
      <p className="mb-5 max-w-2xl text-xs leading-relaxed text-muted-foreground" data-testid="criterion-hint">{t(`${criterion}_hint`)}</p>

      <div className="panel max-w-2xl divide-y divide-border/70 rounded-lg" data-testid="leaderboard-list">
        {rows === null && <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>}
        {rows?.length === 0 && <div className="p-6 text-sm text-muted-foreground">{t("no_data")}</div>}
        {rows?.map((r) => (
          <div key={r.student_id} data-testid={`leaderboard-row-${r.rank}`} className={`relative flex items-center gap-4 px-4 py-3 ${me === r.student_id ? "bg-primary/[0.05] before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-primary" : ""}`}>
            <div className={`w-8 shrink-0 text-center font-display text-xl font-semibold tabular-nums ${r.rank <= 3 ? "text-foreground" : "text-muted-foreground"}`}>
              {r.rank === 1 ? <StarMark size={20} className="mx-auto text-gold" /> : r.rank}
            </div>
            <div className="min-w-0 flex-1 truncate font-semibold">
              {r.name}{me === r.student_id && <span className="ms-2 text-xs font-medium text-primary">({t("you")})</span>}
            </div>
            <div className="shrink-0 text-lg font-semibold tabular-nums">
              {r.value}<span className="ms-1 text-xs font-normal text-muted-foreground">{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
