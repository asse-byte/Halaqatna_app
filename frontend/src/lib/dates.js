/**
 * Dates as the teacher's calendar shows them.
 *
 * `new Date().toISOString().slice(0, 10)` is the date in UTC, not here: in Jeddah (UTC+3)
 * it still reads yesterday until three in the morning, so a register taken just after
 * midnight — or an evening circle in a timezone west of UTC — lands on the wrong day.
 */
const pad = (n) => String(n).padStart(2, "0");

/** YYYY-MM-DD for a Date in local time. */
export const toLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today in local time, as YYYY-MM-DD — the value a date input expects. */
export const localToday = () => toLocalDate(new Date());

/** Any date or timestamp the API returns, shown as a local YYYY-MM-DD. */
export function formatDate(value) {
  if (!value) return "—";
  // A bare date has no timezone to convert; parsing it would shift it by the UTC offset.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : toLocalDate(d);
}

/** A calendar date written out ("12 March 2027"), in Western digits like the rest of the app. */
export function longDate(value, locale) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return formatDate(value);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn-ca-gregory" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
}
