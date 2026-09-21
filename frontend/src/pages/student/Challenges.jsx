import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { btnPrimary, PageTitle } from "../../components/ui-kit";

export default function Challenges() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [d, setD] = useState(null);
  const load = () => api.get(`/students/${actor.student_id}/challenges`).then((r) => setD(r.data));
  useEffect(() => { load(); }, []);
  const join = (c) => api.post(`/students/${actor.student_id}/challenges/${c.challenge_id}/join`).then(() => { toast.success(t("joined")); load(); }).catch((e) => toast.error(errMsg(e)));
  const title = (c) => (locale === "ar" ? c.title_ar : c.title_en);
  return (
    <div>
      <PageTitle title={t("challenges_title")} />
      <h2 className="eyebrow mb-2">{t("my_challenges")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="my-challenges">
        {d?.mine.length === 0 && <div className="text-sm text-muted-foreground">{t("no_data")}</div>}
        {d?.mine.map((c) => { const pct = Math.min(100, Math.round((c.pivot.progress / c.target_value) * 100)); return (
          <div key={c.challenge_id} data-testid={`my-challenge-${c.challenge_id}`} className="glass rounded-2xl p-4 animate-rise">
            <div className="flex items-start justify-between gap-2"><div className="font-bold">{title(c)}</div><span className={`chip !min-h-0 text-[11px] ${c.pivot.status === "COMPLETED" ? "border-emerald-300 text-emerald-700" : c.pivot.status === "EXPIRED" ? "border-red-300 text-red-700" : "border-gold text-gold"}`}>{t(`ch_${c.pivot.status}`)}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-secondary transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{t("progress")} {c.pivot.progress}/{c.target_value}</span><span>+{c.xp_reward} {t("xp")}</span></div>
          </div>); })}
      </div>
      <h2 className="eyebrow mb-2 mt-8">{t("available_challenges")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="available-challenges">
        {d?.available.map((c) => <div key={c.challenge_id} data-testid={`challenge-${c.challenge_id}`} className="glass rounded-2xl p-4 animate-rise">
          <div className="flex items-center gap-2 font-bold"><Flag size={16} className="text-gold" />{title(c)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{c.target_value} {t("pages")} · {c.duration_days} {t("days")} · {t("reward")} +{c.xp_reward} {t("xp")}</div>
          <button data-testid={`join-challenge-${c.challenge_id}`} className={`${btnPrimary} mt-3 w-full`} onClick={() => join(c)}>{t("join")}</button>
        </div>)}
      </div>
    </div>
  );
}
