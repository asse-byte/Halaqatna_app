// NFR6 CI check: every UI string must exist in both ar and en.
//
// Two checks. Parity: every key in one locale file is in the other, and none is empty.
// Coverage: every literal key the web and mobile clients pass to t("...") exists — a key
// that is missing from both files renders as the bare key, which is exactly the
// untranslated string NFR6 forbids. Keys built at run time (t(`band_${x}`)) cannot be read
// statically and are covered by parity alone.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "frontend", "src", "locales");
const ar = JSON.parse(fs.readFileSync(path.join(dir, "ar.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));

const missingEn = Object.keys(ar).filter((k) => !(k in en));
const missingAr = Object.keys(en).filter((k) => !(k in ar));
const empty = [...Object.entries(ar), ...Object.entries(en)].filter(([, v]) => !String(v).trim()).map(([k]) => k);

function sources(d) {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : sources(p);
    return /\.(jsx?|mjs)$/.test(e.name) ? [p] : [];
  });
}

const undefinedKeys = [];
for (const file of [...sources(path.join(root, "frontend", "src")), ...sources(path.join(root, "mobile", "src")), path.join(root, "mobile", "App.js")]) {
  if (!fs.existsSync(file)) continue;
  for (const [, key] of fs.readFileSync(file, "utf8").matchAll(/\bt\(\s*"([^"]+)"/g)) {
    if (!(key in en) || !(key in ar)) undefinedKeys.push(`${path.relative(root, file)}: ${key}`);
  }
}

if (missingEn.length || missingAr.length || empty.length || undefinedKeys.length) {
  console.error("Locale check FAILED", { missingEn, missingAr, empty, undefinedKeys });
  process.exit(1);
}
console.log(`Locale parity OK — ${Object.keys(ar).length} keys in ar and en, every key used by the clients defined`);
