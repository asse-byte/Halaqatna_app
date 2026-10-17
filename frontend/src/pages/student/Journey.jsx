import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Crown, FlaskConical, Headphones, Lock, MapPin, Sparkles } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { ayahCount, surahName, surahsInJuz } from "../../lib/surahs";
import { DEMO_RECITER, recitationUrl } from "../../lib/recitation";
import { btnGhost, Modal, PageTitle } from "../../components/ui-kit";

// Gold is earned: a completed Juz (and a completed Surah inside one) is the only thing on the
// map painted gold. The Juz being memorised now carries the circle's own green, and
// everything ahead is greyed out behind a lock.
const TILE = {
  MASTERED: "border-amber-300/80 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-white shadow-[0_10px_24px_-14px_rgba(180,83,9,0.9)]",
  IN_PROGRESS: "border-primary/40 bg-primary text-primary-foreground ring-4 ring-primary/20",
  NOT_STARTED: "border-border bg-muted/70 text-muted-foreground",
};
const TILE_ICON = { MASTERED: Crown, IN_PROGRESS: MapPin, NOT_STARTED: Lock };
const SWATCH = { MASTERED: "bg-gradient-to-br from-amber-300 to-amber-600", IN_PROGRESS: "bg-primary", NOT_STARTED: "border border-border bg-muted" };
const SURAH_TONE = {
  MASTERED: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary dark:text-foreground",
  LOCKED: "border-border bg-muted/60 text-muted-foreground",
};
const SURAH_ICON = { MASTERED: Crown, IN_PROGRESS: Sparkles, LOCKED: Lock };

/** Every ayah the student has recited in an attended session, as ranges per Surah. */
function recitedRanges(sessions) {
  const bySurah = new Map();
  for (const s of sessions) {
    if (!s.surah_from || !["P", "L"].includes(s.attendance_status)) continue;
    const last = s.surah_to ?? s.surah_from;
    for (let n = s.surah_from; n <= last; n++) {
      const from = n === s.surah_from ? s.ayah_from ?? 1 : 1;
      const to = n === last ? s.ayah_to ?? s.ayah_from ?? ayahCount(n) : ayahCount(n);
      if (!bySurah.has(n)) bySurah.set(n, []);
      bySurah.get(n).push([from, to]);
    }
  }
  return bySurah;
}

/** How many of a segment's ayahs the recorded ranges cover, overlaps counted once. */
function coveredAyahs(ranges, seg) {
  const clipped = (ranges.get(seg.surah) ?? [])
    .map(([a, b]) => [Math.max(a, seg.from), Math.min(b, seg.to)])
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0]);
  let n = 0, end = seg.from - 1;
  for (const [a, b] of clipped) {
    if (b > end) { n += b - Math.max(a, end + 1) + 1; end = b; }
  }
  return n;
}

/**
 * The Surahs of one Juz and where the student stands in each.
 *
 * A Juz before the current one is complete and one after it is locked — the same reading of
 * progress as the tiles, which the API derives from current_juz. Inside the Juz being
 * memorised, a Surah is mastered when the passages the teacher recorded cover all of its
 * ayahs in that Juz, and in progress when they cover some; if none has been started, the
 * first one not yet mastered is marked as the current step. Nothing here is stored.
 */
function surahStatuses(juz, tileStatus, ranges) {
  const segs = surahsInJuz(juz);
  if (tileStatus === "MASTERED") return segs.map((s) => ({ ...s, status: "MASTERED" }));
  if (tileStatus === "NOT_STARTED") return segs.map((s) => ({ ...s, status: "LOCKED" }));
  const rows = segs.map((s) => {
    const c = coveredAyahs(ranges, s);
    return { ...s, status: c >= s.to - s.from + 1 ? "MASTERED" : c > 0 ? "IN_PROGRESS" : "LOCKED" };
  });
  if (!rows.some((s) => s.status === "IN_PROGRESS")) {
    const next = rows.find((s) => s.status !== "MASTERED");
    if (next) next.status = "IN_PROGRESS";
  }
  return rows;
}

export default function Journey() {
  const { t, locale } = useT();
  const { actor } = useAuth();
  const [j, setJ] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(null);       // the Juz tile whose Surahs are shown
  const [playing, setPlaying] = useState(null); // the Surah segment being listened to

  useEffect(() => {
    api.get(`/students/${actor.student_id}/journey`).then((r) => setJ(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get(`/students/${actor.student_id}/sessions`).then((r) => setSessions(r.data)).catch(() => {});
  }, [actor.student_id]);

  const ranges = useMemo(() => recitedRanges(sessions), [sessions]);
  const rows = useMemo(() => (open ? surahStatuses(open.juz, open.status, ranges) : []), [open, ranges]);

  const tiles = j?.tiles ?? [];
  const done = tiles.filter((x) => x.status === "MASTERED").length;
  const current = tiles.find((x) => x.status === "IN_PROGRESS");

  return (
    <div>
      <PageTitle title={t("journey_title")} subtitle={t("journey_hint")} />

      {j && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3" data-testid="journey-summary">
          <div className="glass flex items-center gap-3 rounded-2xl p-4 animate-rise">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-white"><Crown size={18} /></span>
            <div className="min-w-0">
              <div className="text-xl font-bold text-primary dark:text-foreground">{t("juz_done_count", { n: done })}</div>
              <div className="text-xs text-muted-foreground">{t("st_MASTERED")}</div>
            </div>
          </div>
          {current && (
            <div className="glass rounded-2xl p-4 animate-rise" style={{ animationDelay: "40ms" }}>
              <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span className="flex items-center gap-2"><MapPin size={16} className="text-primary dark:text-foreground" />{t("juz")} {current.juz}</span>
                <span className="text-xs text-muted-foreground">{current.progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${current.progress}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{t("st_IN_PROGRESS")}</div>
            </div>
          )}
          {current && current.juz < 30 && (
            <div className="glass flex items-center gap-3 rounded-2xl p-4 animate-rise" style={{ animationDelay: "80ms" }}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Lock size={16} /></span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t("juz_next_goal", { juz: current.juz + 1 })}</div>
                <div className="text-xs text-muted-foreground">{t("juz_next_goal_hint")}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 sm:gap-3 md:grid-cols-10" data-testid="journey-grid">
        {tiles.map((tile, i) => {
          const Icon = TILE_ICON[tile.status];
          return (
            <button key={tile.juz} type="button" data-testid={`juz-progress-tile-${tile.juz}`} onClick={() => setOpen(tile)}
              aria-label={`${t("juz")} ${tile.juz} · ${t(`st_${tile.status}`)}${tile.status === "IN_PROGRESS" ? ` · ${tile.progress}%` : ""}`}
              className={`group relative aspect-square overflow-hidden rounded-2xl border p-2 text-start outline-none animate-rise transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.05] focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-95 ${TILE[tile.status]}`}
              style={{ animationDelay: `${i * 20}ms` }}>
              <span className="font-quran text-lg font-bold leading-none sm:text-2xl">{tile.juz}</span>
              <Icon size={13} className={`absolute end-1.5 top-1.5 sm:end-2 sm:top-2 ${tile.status === "NOT_STARTED" ? "opacity-50" : "opacity-90"}`} aria-hidden="true" />
              {tile.status === "IN_PROGRESS" && (
                <>
                  <span className="absolute inset-0 rounded-2xl ring-2 ring-primary/40 motion-safe:animate-pulse" aria-hidden="true" />
                  <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/25"><span className="block h-full bg-white" style={{ width: `${tile.progress}%` }} /></span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {Object.entries(SWATCH).map(([s, cls]) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${cls}`} />{t(`st_${s}`)}</span>
        ))}
        <span className="text-muted-foreground">· {t("journey_tap_hint")}</span>
      </div>

      <Modal open={!!open && !playing} onClose={() => setOpen(null)} wide
        title={open ? `${t("juz")} ${open.juz}` : ""}
        subtitle={open ? `${t(`st_${open.status}`)} · ${t("juz_surah_count", { n: rows.length })}` : ""}>
        {open && (
          <div data-testid="juz-surah-modal">
            {open.status === "IN_PROGRESS" && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t("juz_status_from_sessions")}</p>}
            <ul className="-me-2 max-h-[60vh] space-y-2 overflow-y-auto pe-2">
              {rows.map((s) => {
                const Icon = SURAH_ICON[s.status];
                return (
                  <li key={s.surah} data-testid={`juz-surah-${s.surah}`}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 ${s.status === "MASTERED" ? "border-amber-300/70 bg-amber-50/60 dark:border-amber-700/50 dark:bg-amber-950/20" : "border-border/70"}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${SURAH_TONE[s.status]}`}><Icon size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className={`font-quran text-lg font-bold leading-tight ${s.status === "LOCKED" ? "text-muted-foreground" : ""}`}>{surahName(s.surah, locale)}</div>
                      <div className="text-xs text-muted-foreground">{s.whole ? t("surah_whole") : t("ayahs_range", { from: s.from, to: s.to })}</div>
                    </div>
                    <span className={`chip !min-h-0 shrink-0 !px-2.5 !py-0.5 text-[11px] font-semibold ${SURAH_TONE[s.status]}`} data-testid={`surah-status-${s.surah}`}>{t(`surah_${s.status}`)}</span>
                    <button type="button" className={`${btnGhost} w-full !py-1.5 text-xs sm:w-auto`} onClick={() => setPlaying(s)} data-testid={`listen-${s.surah}`}>
                      <Headphones size={14} />{t("listen_model")}
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
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <FlaskConical size={15} className="mt-0.5 shrink-0" />
          <span><span className="font-bold">{t("listen_demo_badge")}</span> · {t("listen_demo_note", { reciter: DEMO_RECITER[locale] ?? DEMO_RECITER.en })}</span>
        </div>
        <audio key={segment.surah} controls autoPlay preload="metadata" src={recitationUrl(segment.surah)} className="mt-4 w-full" onError={() => setFailed(true)} data-testid="recitation-audio">
          {t("listen_failed")}
        </audio>
        {failed && <p className="mt-2 text-xs font-semibold text-destructive" data-testid="recitation-failed">{t("listen_failed")}</p>}
        {!segment.whole && <p className="mt-3 text-xs text-muted-foreground">{t("listen_partial_hint", { from: segment.from, to: segment.to })}</p>}
        <div className="mt-5 flex justify-end">
          <button type="button" className={btnGhost} onClick={onClose} data-testid="back-to-juz">{t("back_to_juz")}</button>
        </div>
      </div>
    </Modal>
  );
}
