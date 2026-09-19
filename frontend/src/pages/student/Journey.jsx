import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { PageTitle } from "../../components/ui-kit";

const STYLE = { MASTERED: "bg-primary text-primary-foreground", IN_PROGRESS: "bg-gold text-white ring-4 ring-gold/30", NOT_STARTED: "bg-muted text-muted-foreground" };

export default function Journey() {
  const { t } = useT();
  const { actor } = useAuth();
  const [j, setJ] = useState(null);
  useEffect(() => { api.get(`/students/${actor.student_id}/journey`).then((r) => setJ(r.data)); }, []);
  return (
    <div>
      <PageTitle title={t("journey_title")} subtitle={`${t("current_juz")}: ${j?.current_juz ?? "…"}`} />
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-10" data-testid="journey-grid">
        {j?.tiles.map((tile, i) => <div key={tile.juz} data-testid={`juz-progress-tile-${tile.juz}`} title={`${t("juz")} ${tile.juz} · ${t(`st_${tile.status}`)} · ${tile.progress}%`} className={`relative aspect-square overflow-hidden rounded-2xl p-2 animate-rise transition-transform hover:scale-105 ${STYLE[tile.status]}`} style={{ animationDelay: `${i * 25}ms` }}>
          <div className="font-quran text-lg font-bold">{tile.juz}</div>
          {tile.status === "IN_PROGRESS" && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/30"><div className="h-full bg-white" style={{ width: `${tile.progress}%` }} /></div>}
        </div>)}
      </div>
      <div className="mt-5 flex flex-wrap gap-3 text-xs">{Object.keys(STYLE).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${STYLE[s].split(" ")[0]}`} />{t(`st_${s}`)}</span>)}</div>
    </div>
  );
}
