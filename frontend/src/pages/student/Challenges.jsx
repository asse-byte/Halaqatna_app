import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnGhost, PageTitle } from "../../components/ui-kit";

export default function Challenges() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [d, setD] = useState(null);
  const load = () => api.get(`/students/${actor.student_id}/challenges`).then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);
  const join = (c) => api.post(`/students/${actor.student_id}/challenges/${c.challenge_id}/join`).then(() => { toast.success(t("joined")); load(); }).catch((e) => toast.error(errMsg(e)));
  const title = (c) => (locale === "ar" ? c.title_ar : c.title_en);
  return (
    <div>
      <PageTitle title={t("challenges_title")} />
      <h2 className="panel-title mb-3">{t("my_challenges")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="my-challenges">
        {d?.mine.length === 0 && <div className="text-sm text-muted-foreground">{t("no_data")}</div>}
        {d?.mine.map((c) => { const pct = Math.min(100, Math.round((c.pivot.progress / c.target_value) * 100)); return (
          <div key={c.challenge_id} data-testid={`my-challenge-${c.challenge_id}`} className="panel rounded-lg p-4">
            <div className="flex items-start justify-between gap-2"><div className="font-semibold">{title(c)}</div><span className={`chip !min-h-0 shrink-0 text-[11px] ${c.pivot.status === "COMPLETED" ? "border-success/35 bg-success/[0.07] text-success" : c.pivot.status === "EXPIRED" ? "border-destructive/35 bg-destructive/[0.07] text-destructive" : "border-primary/30 bg-primary/[0.06] text-primary"}`}>{t(`ch_${c.pivot.status}`)}</span></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{t("progress")} {c.pivot.progress}/{c.target_value}</span><span className="font-semibold text-gold-ink">+{c.xp_reward} {t("xp")}</span></div>
          </div>); })}
      </div>
      <h2 className="panel-title mb-3 mt-10">{t("available_challenges")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="available-challenges">
        {d?.available.map((c) => <div key={c.challenge_id} data-testid={`challenge-${c.challenge_id}`} className="panel rounded-lg p-4">
          <div className="flex items-center gap-2 font-semibold"><Flag size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />{title(c)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{c.target_value} {t("pages")} · {c.duration_days} {t("days")} · {t("reward")} +{c.xp_reward} {t("xp")}</div>
          <button data-testid={`join-challenge-${c.challenge_id}`} className={`${btnGhost} mt-4 w-full`} onClick={() => join(c)}>{t("join")}</button>
        </div>)}
      </div>
    </div>
  );
}
