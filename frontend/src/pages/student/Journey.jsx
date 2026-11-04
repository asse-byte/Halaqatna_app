import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FlaskConical, Headphones, Lock, MapPin, Trophy } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { surahName } from "../../lib/surahs";
import { recitedRanges, surahStatuses } from "../../lib/juzProgress";
import { DEMO_RECITER, readAlongUrl, recitationUrl } from "../../lib/recitation";
import { btnGhost, Figures, Modal, PageTitle } from "../../components/ui-kit";
import { StarMark } from "../../components/Brand";

// Gold is earned: a completed Juz (and a completed Surah inside one) is the only thing on the
// map painted in the illumination gold, marked with the rub el hizb star. The Juz being
// memorised now is lapis, the action colour, and everything ahead waits behind a lock.
const TILE = {
  MASTERED: "border-gold bg-gold text-primary-foreground",
  IN_PROGRESS: "border-primary bg-primary text-primary-foreground",
  NOT_STARTED: "border-border bg-card text-muted-foreground hover:border-input hover:text-foreground",
};
const TILE_ICON = {
  MASTERED: (p) => <StarMark size={13} {...p} />,
  IN_PROGRESS: (p) => <MapPin size={13} strokeWidth={2} {...p} />,
  NOT_STARTED: (p) => <Lock size={12} strokeWidth={1.75} {...p} />,
};
const SWATCH = { MASTERED: "bg-gold", IN_PROGRESS: "bg-primary", NOT_STARTED: "border border-input bg-card" };
const SURAH_TONE = {
  MASTERED: "border-gold/45 bg-gold/10 text-gold-ink",
  IN_PROGRESS: "border-primary/30 bg-primary/[0.06] text-primary",
  LOCKED: "border-border bg-muted/60 text-muted-foreground",
};
const SURAH_ICON = {
  MASTERED: (p) => <StarMark size={20} {...p} />,
  IN_PROGRESS: (p) => <MapPin size={14} {...p} />,
  LOCKED: (p) => <Lock size={13} {...p} />,
};

// The trail: a winding path of stages, from the first Juz at the top down to the last.
const GAP = 104, TOP = 52;
const nodeX = (i) => 50 + 30 * Math.sin((i * Math.PI) / 3.5);
const nodeY = (i) => TOP + i * GAP;

/** The trail between two stages as an SVG path, sampled finely enough to read as a curve. */
function trail(fromIndex, toIndex) {
  const parts = [];
  for (let i = fromIndex; i <= toIndex + 1e-6; i += 0.1) parts.push(`${parts.length ? "L" : "M"}${nodeX(i).toFixed(2)},${nodeY(i).toFixed(1)}`);
  return parts.join(" ");
}

export default function Journey() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [j, setJ] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(null);       // the Juz tile whose Surahs are shown
  const [playing, setPlaying] = useState(null); // the Surah segment being listened to
  const currentRef = useRef(null);

  useEffect(() => {
    api.get(`/students/${actor.student_id}/journey`).then((r) => setJ(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get(`/students/${actor.student_id}/sessions`).then((r) => setSessions(r.data)).catch(() => {});
  }, [actor.student_id]);

  const ranges = useMemo(() => recitedRanges(sessions), [sessions]);
  const rows = useMemo(() => (open ? surahStatuses(open.juz, open.status, ranges) : []), [open, ranges]);

  const tiles = useMemo(() => (j?.tiles ?? []).map((tile) => {
    const stations = surahStatuses(tile.juz, tile.status, ranges);
    return { ...tile, surahs: stations.length, stars: stations.filter((x) => x.status === "MASTERED").length };
  }), [j, ranges]);
  const done = tiles.filter((x) => x.status === "MASTERED").length;
  const current = tiles.find((x) => x.status === "IN_PROGRESS");
  const height = TOP + 30 * GAP + 44;
  const currentIndex = (j?.current_juz ?? 1) - 1;

  // Open on the stage the student is on, not at the top of a long trail.
  useEffect(() => {
    if (j && j.current_juz > 2) currentRef.current?.scrollIntoView({ block: "center" });
  }, [j]);

  return (
    <div>
      <PageTitle title={t("journey_title")} subtitle={t("journey_hint")} />

      {j && (
        <Figures className="mb-6 sm:grid-cols-3" testId="journey-summary">
          <div className="p-4 sm:p-5">
            <div className="eyebrow">{t("st_MASTERED")}</div>
            <div className="mt-3 flex items-center gap-2">
              <StarMark size={20} className="text-gold" />
              <span className="text-xl font-semibold">{t("juz_done_count", { n: done })}</span>
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground" data-testid="journey-stars">{t("journey_stars", { n: tiles.reduce((n, x) => n + x.stars, 0) })}</div>
          </div>
          {current && (
            <div className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="eyebrow">{t("st_IN_PROGRESS")}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{current.progress}%</span>
              </div>
              <div className="mt-3 text-xl font-semibold">{t("juz")} {current.juz}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${current.progress}%` }} />
              </div>
            </div>
          )}
          {current && current.juz < 30 && (
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Lock size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />{t("juz_next_goal", { juz: current.juz + 1 })}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{t("juz_next_goal_hint")}</div>
            </div>
          )}
        </Figures>
      )}

      {/* Always left-to-right, so the path has the same shape in both languages. */}
      <div className="relative mx-auto max-w-md" style={{ height }} dir="ltr" data-testid="journey-grid">
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={trail(0, 30)} fill="none" stroke="hsl(var(--border))" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {currentIndex > 0 && <path d={trail(0, currentIndex)} fill="none" stroke="hsl(var(--gold))" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        </svg>

        {tiles.map((tile, i) => {
          const Icon = TILE_ICON[tile.status];
          return (
            <div key={tile.juz} ref={tile.status === "IN_PROGRESS" ? currentRef : undefined}
              className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${nodeX(i)}%`, top: nodeY(i) }}>
              <button type="button" data-testid={`juz-progress-tile-${tile.juz}`} onClick={() => setOpen(tile)}
                aria-label={`${t("juz")} ${tile.juz} · ${t(`st_${tile.status}`)}${tile.status === "IN_PROGRESS" ? ` · ${tile.progress}%` : ""}`}
                className={`relative grid h-[60px] w-[60px] place-items-center rounded-full border-2 shadow-sm transition-[transform,border-color,color] duration-150 hover:-translate-y-0.5 active:translate-y-0 ${TILE[tile.status]} ${tile.status === "IN_PROGRESS" ? "ring-4 ring-primary/20" : ""}`}>
                <span className="font-display text-xl font-semibold leading-none tabular-nums">{tile.juz}</span>
                <span className="absolute -end-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-card text-foreground">
                  <Icon className={tile.status === "NOT_STARTED" ? "opacity-60" : tile.status === "MASTERED" ? "text-gold" : "text-primary"} />
                </span>
              </button>
              {tile.status === "IN_PROGRESS" && <span dir="auto" className="mt-1.5 whitespace-nowrap rounded-sm bg-primary px-1.5 py-px text-[11px] font-semibold text-primary-foreground">{t("journey_here")} · {tile.progress}%</span>}
              {tile.status !== "MASTERED" && tile.stars > 0 && (
                <span className="mt-1 flex items-center gap-1 rounded-sm border border-border bg-card px-1.5 py-px text-[11px] font-semibold" data-testid={`juz-stars-${tile.juz}`}>
                  <StarMark size={11} className="text-gold" /><span className="tabular-nums">{tile.stars}/{tile.surahs}</span>
                </span>
              )}
            </div>
          );
        })}

        <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${nodeX(30)}%`, top: nodeY(30) }}>
          <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-gold bg-card text-gold"><Trophy size={20} strokeWidth={1.75} /></span>
          <span className="mt-1 whitespace-nowrap rounded-sm bg-card px-1.5 text-[11px] font-semibold">{t("journey_finish")}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        {Object.entries(SWATCH).map(([st, cls]) => (
          <span key={st} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${cls}`} />{t(`st_${st}`)}</span>
        ))}
        <span className="text-muted-foreground">{t("journey_tap_hint")}</span>
      </div>

      <Modal open={!!open && !playing} onClose={() => setOpen(null)} wide
        title={open ? `${t("juz")} ${open.juz}` : ""}
        subtitle={open ? `${t(`st_${open.status}`)} · ${t("juz_surah_count", { n: rows.length })}` : ""}>
        {open && (
          <div data-testid="juz-surah-modal">
            {open.status === "IN_PROGRESS" && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t("juz_status_from_sessions")}</p>}
            <ul className="-mx-5 max-h-[60vh] divide-y divide-border overflow-y-auto border-y border-border">
              {rows.map((s) => {
                const Icon = SURAH_ICON[s.status];
                return (
                  <li key={s.surah} data-testid={`juz-surah-${s.surah}`}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 ${s.status === "MASTERED" ? "bg-gold/[0.06]" : ""}`}>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${SURAH_TONE[s.status]}`}><Icon /></span>
                    <div className="min-w-0 flex-1">
                      <div className={`font-quran text-lg font-bold leading-tight ${s.status === "LOCKED" ? "text-muted-foreground" : ""}`}>{surahName(s.surah, locale)}</div>
                      <div className="text-xs text-muted-foreground">{s.whole ? t("surah_whole") : t("ayahs_range", { from: s.from, to: s.to })}</div>
                    </div>
                    <span className={`chip !min-h-0 shrink-0 !px-2 !py-0.5 text-[11px] font-semibold ${SURAH_TONE[s.status]}`} data-testid={`surah-status-${s.surah}`}>{t(`surah_${s.status}`)}</span>
                    <button type="button" className={`${btnGhost} w-full !py-1.5 text-xs sm:w-auto`} onClick={() => setPlaying(s)} data-testid={`listen-${s.surah}`}>
                      <Headphones size={14} strokeWidth={1.75} />{t("listen_model")}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>

      {playing && <RecitationModal segment={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/**
 * DEMO — the model recitation of one Surah (see lib/recitation.js). Labelled as a demo on
 * screen, because the audio comes from a public archive outside the system.
 */
function RecitationModal({ segment, onClose }) {
  const { t, locale } = useT();
  const [failed, setFailed] = useState(false);
  return (
    <Modal open onClose={onClose} wide title={t("listen_model")} subtitle={surahName(segment.surah, locale)}>
      <div data-testid="recitation-modal">
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          <FlaskConical size={15} className="mt-0.5 shrink-0" />
          <span><span className="me-1 rounded-sm border border-input bg-card px-1.5 py-px font-semibold text-foreground">{t("listen_demo_badge")}</span> · {t("listen_demo_note", { reciter: DEMO_RECITER[locale] ?? DEMO_RECITER.en })}</span>
        </div>
        <audio key={segment.surah} controls autoPlay preload="metadata" src={recitationUrl(segment.surah)} className="mt-4 w-full" onError={() => setFailed(true)} data-testid="recitation-audio">
          {t("listen_failed")}
        </audio>
        {failed && <p className="mt-2 text-xs font-semibold text-destructive" data-testid="recitation-failed">{t("listen_failed")}</p>}
        {!segment.whole && <p className="mt-3 text-xs text-muted-foreground">{t("listen_partial_hint", { from: segment.from, to: segment.to })}</p>}
        <a href={readAlongUrl(segment.surah)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline" data-testid="read-along-link">
          <ExternalLink size={13} />{t("journey_read_along")}
        </a>
        <div className="mt-5 flex justify-end">
          <button type="button" className={btnGhost} onClick={onClose} data-testid="back-to-juz">{t("back_to_juz")}</button>
        </div>
      </div>
    </Modal>
  );
}
