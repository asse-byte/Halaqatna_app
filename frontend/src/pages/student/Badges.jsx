import { useEffect, useState } from "react";
import { Award, Lock } from "lucide-react";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { PageTitle } from "../../components/ui-kit";

export default function Badges() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [d, setD] = useState(null);
  const [xp, setXp] = useState(null);
  useEffect(() => { api.get(`/students/${actor.student_id}/badges`).then((r) => setD(r.data)); api.get(`/students/${actor.student_id}/xp`).then((r) => setXp(r.data)); }, []);
  const earned = new Map((d?.earned || []).map((b) => [b.badge_id, b.pivot.earned_at]));
  return (
    <div>
      <PageTitle title={t("badges_title")} subtitle={xp ? `${t("xp")}: ${xp.total}` : ""} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="badges-grid">
        {d?.all.map((b, i) => { const at = earned.get(b.badge_id); return (
          <div key={b.badge_id} data-testid={`badge-${b.badge_id}`} className={`glass rounded-2xl p-4 text-center animate-rise ${at ? "" : "opacity-50 grayscale"}`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${at ? "bg-gold text-white" : "bg-muted"}`}>{at ? <Award size={22} /> : <Lock size={18} />}</div>
            <div className="mt-2 text-sm font-bold">{locale === "ar" ? b.name_ar : b.name_en}</div>
            {/* What is still needed, in words. The stored condition code — PAGES_TOTAL,
                STREAK_SESSIONS — is the Gamification Engine's vocabulary, not a child's. */}
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              {at ? `${t("earned_at")} ${String(at).slice(0, 10)}` : t(`cond_${b.condition_type}`, { n: b.condition_value })}
            </div>
          </div>); })}
      </div>
      <h2 className="eyebrow mb-2 mt-8">{t("xp_ledger")}</h2>
      <div className="glass max-w-xl divide-y divide-border/60 rounded-2xl" data-testid="xp-ledger">
        {xp?.ledger.slice(0, 20).map((e) => (
          <div key={e.entry_id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span>
              {t(`reason_${e.reason}`)}
              <span className="ms-2 text-[11px] text-muted-foreground" dir="ltr">{String(e.created_at).slice(0, 10)}</span>
            </span>
            {/* A correction can take points away, so the sign comes from the value itself. */}
            <span className={`font-mono font-semibold ${e.points < 0 ? "text-destructive" : "text-gold"}`} dir="ltr">{e.points > 0 ? `+${e.points}` : e.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
