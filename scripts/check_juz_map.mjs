// UC20 — the Surahs behind each stage of the journey map, and how a Surah earns its star.
import assert from "node:assert/strict";
import test from "node:test";
import { recitedRanges, surahStatuses } from "../frontend/src/lib/juzProgress.js";
import { ayahCount, surahsInJuz } from "../frontend/src/lib/surahs.js";

test("the 30 Juz cover every ayah of the Quran exactly once", () => {
  const seen = new Set();
  for (let juz = 1; juz <= 30; juz++) {
    for (const { surah, from, to } of surahsInJuz(juz)) {
      for (let a = from; a <= to; a++) {
        const key = `${surah}:${a}`;
        assert.ok(!seen.has(key), `${key} appears twice`);
        seen.add(key);
      }
    }
  }
  assert.equal(seen.size, 6236);
  for (let surah = 1; surah <= 114; surah++) assert.ok(seen.has(`${surah}:${ayahCount(surah)}`), `Surah ${surah} is cut short`);
});

const session = (surah_from, ayah_from, surah_to, ayah_to, attendance_status = "P") => ({ surah_from, ayah_from, surah_to, ayah_to, attendance_status });
const status = (rows, surah) => rows.find((s) => s.surah === surah).status;

test("a star takes every ayah, across any number of sessions", () => {
  const partial = surahStatuses(30, "NOT_STARTED", recitedRanges([session(78, 1, 78, 20)]));
  assert.equal(status(partial, 78), "IN_PROGRESS");

  const whole = surahStatuses(30, "NOT_STARTED", recitedRanges([session(78, 1, 78, 20), session(78, 21, 78, 40)]));
  assert.equal(status(whole, 78), "MASTERED");
  assert.equal(status(whole, 79), "LOCKED");
});

test("stars are earned in Juz 30 while the current Juz is an earlier one", () => {
  const rows = surahStatuses(30, "NOT_STARTED", recitedRanges([session(78, 1, 80, 42)]));
  assert.deepEqual([78, 79, 80, 81].map((n) => status(rows, n)), ["MASTERED", "MASTERED", "MASTERED", "LOCKED"]);
});

test("an absence earns nothing, and a completed Juz stars all its Surahs", () => {
  assert.equal(recitedRanges([session(78, 1, 78, 40, "A"), { surah_from: null, attendance_status: "P" }]).size, 0);
  assert.ok(surahStatuses(29, "MASTERED", new Map()).every((s) => s.status === "MASTERED"));
});

test("the current Juz always shows a next step, and a later one does not invent any", () => {
  assert.equal(status(surahStatuses(29, "IN_PROGRESS", new Map()), 67), "IN_PROGRESS");
  assert.equal(status(surahStatuses(29, "NOT_STARTED", new Map()), 67), "LOCKED");
});
