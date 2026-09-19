// NFR6 CI check: every UI string must exist in both ar and en.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "frontend", "src", "locales");
const ar = JSON.parse(fs.readFileSync(path.join(dir, "ar.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
const missingEn = Object.keys(ar).filter((k) => !(k in en));
const missingAr = Object.keys(en).filter((k) => !(k in ar));
const empty = [...Object.entries(ar), ...Object.entries(en)].filter(([, v]) => !String(v).trim()).map(([k]) => k);
if (missingEn.length || missingAr.length || empty.length) {
  console.error("Locale parity check FAILED", { missingEn, missingAr, empty });
  process.exit(1);
}
console.log(`Locale parity OK — ${Object.keys(ar).length} keys in ar and en`);
