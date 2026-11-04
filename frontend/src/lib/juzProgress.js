import { ayahCount, surahsInJuz } from "./surahs.js";

/** Every ayah the student has recited in an attended session, as ranges per Surah. */
export function recitedRanges(sessions) {
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
 * The Surahs of one Juz and where the student stands in each. Nothing here is stored.
 *
 * A Juz before the current one is complete, the same reading of progress as the map, which the
 * API derives from current_juz. Anywhere else a Surah is mastered when the passages the teacher
 * recorded cover all of its ayahs in that Juz, in progress when they cover some, and locked
 * otherwise, so a student who began with the short Surahs earns their stars in Juz 30 even
 * while their current Juz is an earlier one. Inside the current Juz, if none has been started,
 * the first one not yet mastered is marked as the current step.
 */
export function surahStatuses(juz, tileStatus, ranges) {
  const segs = surahsInJuz(juz);
  if (tileStatus === "MASTERED") return segs.map((s) => ({ ...s, status: "MASTERED" }));
  const rows = segs.map((s) => {
    const c = coveredAyahs(ranges, s);
    return { ...s, status: c >= s.to - s.from + 1 ? "MASTERED" : c > 0 ? "IN_PROGRESS" : "LOCKED" };
  });
  if (tileStatus === "IN_PROGRESS" && !rows.some((s) => s.status === "IN_PROGRESS")) {
    const next = rows.find((s) => s.status !== "MASTERED");
    if (next) next.status = "IN_PROGRESS";
  }
  return rows;
}
