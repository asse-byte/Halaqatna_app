import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Headphones, Lock, MapPin } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { ayahCount, surahName, surahsInJuz } from "../../lib/surahs";
import { DEMO_RECITER, recitationUrl } from "../../lib/recitation";
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
  MASTERED: (p) => <StarMark size={14} {...p} />,
  IN_PROGRESS: (p) => <MapPin size={14} {...p} />,
  LOCKED: (p) => <Lock size={13} {...p} />,
};

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
        <Figures className="mb-6 sm:grid-cols-3" testId="journey-summary">
          <div className="p-4 sm:p-5">
            <div className="eyebrow">{t("st_MASTERED")}</div>
            <div className="mt-3 flex items-center gap-2">
              <StarMark size={20} className="text-gold" />
              <span className="text-xl font-semibold">{t("juz_done_count", { n: done })}</span>
            </div>
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

      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 sm:gap-2 md:grid-cols-10" data-testid="journey-grid">
        {tiles.map((tile) => {
          const Icon = TILE_ICON[tile.status];
          return (
            <button key={tile.juz} type="button" data-testid={`juz-progress-tile-${tile.juz}`} onClick={() => setOpen(tile)}
              aria-label={`${t("juz")} ${tile.juz} · ${t(`st_${tile.status}`)}${tile.status === "IN_PROGRESS" ? ` · ${tile.progress}%` : ""}`}
              className={`relative flex aspect-square flex-col justify-between overflow-hidden rounded-md border p-2 text-start transition-[transform,border-color,color] duration-150 hover:-translate-y-px active:translate-y-0 sm:p-2.5 ${TILE[tile.status]}`}>
              <Icon className={tile.status === "NOT_STARTED" ? "opacity-60" : ""} />
              <span className="self-end font-display text-xl font-semibold leading-none tabular-nums sm:text-[26px]">{tile.juz}</span>
              {tile.status === "IN_PROGRESS" && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/20"><span className="block h-full bg-gold" style={{ width: `${tile.progress}%` }} /></span>
              )}
            </button>
          );
        })}
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
        <div className="mt-5 flex justify-end">
          <button type="button" className={btnGhost} onClick={onClose} data-testid="back-to-juz">{t("back_to_juz")}</button>
        </div>
      </div>
    </Modal>
  );
}
