import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { formatDate, longDate } from "../../lib/dates";
import { PageTitle } from "../../components/ui-kit";
import { StarMark } from "../../components/Brand";

export default function Badges() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [d, setD] = useState(null);
  const [xp, setXp] = useState(null);
  useEffect(() => {
    const fail = (e) => toast.error(errMsg(e));
    api.get(`/students/${actor.student_id}/badges`).then((r) => setD(r.data)).catch(fail);
    api.get(`/students/${actor.student_id}/xp`).then((r) => setXp(r.data)).catch(fail);
  }, [actor.student_id]);
  const earned = new Map((d?.earned || []).map((b) => [b.badge_id, b.pivot.earned_at]));
  return (
    <div>
      <PageTitle title={t("badges_title")} subtitle={xp ? `${t("xp")}: ${xp.total}` : ""} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="badges-grid">
        {d?.all.map((b) => { const at = earned.get(b.badge_id); return (
          <div key={b.badge_id} data-testid={`badge-${b.badge_id}`} className={`panel rounded-lg p-4 text-center ${at ? "border-gold/50" : ""}`}>
            <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full border ${at ? "border-gold/50 bg-gold/10 text-gold" : "border-dashed border-input text-muted-foreground/60"}`}>{at ? <StarMark size={26} /> : <Lock size={17} strokeWidth={1.75} />}</div>
            <div className={`mt-3 text-sm font-semibold ${at ? "" : "text-muted-foreground"}`}>{locale === "ar" ? b.name_ar : b.name_en}</div>
            {/* What is still needed, in words. The stored condition code — PAGES_TOTAL,
                STREAK_SESSIONS — is the Gamification Engine's vocabulary, not a child's. */}
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              {at ? `${t("earned_at")} ${longDate(formatDate(at), locale)}` : t(`cond_${b.condition_type}`, { n: b.condition_value })}
            </div>
          </div>); })}
      </div>
      <h2 className="panel-title mb-3 mt-10">{t("xp_ledger")}</h2>
      <div className="panel max-w-xl divide-y divide-border/70 rounded-lg" data-testid="xp-ledger">
        {xp?.ledger.slice(0, 20).map((e) => (
          <div key={e.entry_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span>
              {t(`reason_${e.reason}`)}
              <span className="ms-2 text-[11px] text-muted-foreground">{longDate(formatDate(e.created_at), locale)}</span>
            </span>
            {/* A correction can take points away, so the sign comes from the value itself. */}
            <span className={`font-semibold tabular-nums ${e.points < 0 ? "text-destructive" : "text-gold-ink"}`} dir="ltr">{e.points > 0 ? `+${e.points}` : e.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
