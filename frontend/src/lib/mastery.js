// Mastery as a word — the same thresholds as App\Support\MasteryBand on the server.
// Plain JS with no imports, so the mobile client shares it as it shares the locale files.
export const bandFor = (v) => (v == null ? "NO_DATA" : v >= 90 ? "EXCELLENT" : v >= 75 ? "STRONG" : v >= 50 ? "DEVELOPING" : "NEEDS_WORK");
