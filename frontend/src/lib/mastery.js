// Mastery as a word — the same thresholds as App\Support\MasteryBand on the server.
// Plain JS with no imports, so the mobile client shares it as it shares the locale files.
// The floors are exported so the web's 0–100 scale is cut at exactly the same points.
export const BAND_FLOORS = { EXCELLENT: 90, STRONG: 75, DEVELOPING: 50 };
export const bandFor = (v) => (v == null ? "NO_DATA" : v >= BAND_FLOORS.EXCELLENT ? "EXCELLENT" : v >= BAND_FLOORS.STRONG ? "STRONG" : v >= BAND_FLOORS.DEVELOPING ? "DEVELOPING" : "NEEDS_WORK");
