import { useState } from "react";
import { CalendarCheck, Users } from "lucide-react";
import { useT } from "../lib/i18n";

/**
 * The two at-a-glance charts on the Supervisor's and the teacher's dashboards.
 *
 * Neither introduces a measure. The attendance bars are the register read week by week (the
 * API computes them with the same rule as "average attendance"), and the distribution counts
 * the Mastery bands the table below already prints beside each student — the same words and
 * the same thresholds (MasteryBand on the server, lib/mastery.js here), not a new grouping.
 * Plain Tailwind and SVG-free markup: the web client carries no charting library.
 */

/** Weekly attendance rate — one series, so one colour and no legend; the title names it. */
export function WeeklyAttendanceChart({ weeks = [] }) {
  const { t } = useT();
  const [active, setActive] = useState(null);
  const marked = weeks.filter((w) => w.rate != null);
  const latest = weeks.length - 1 - [...weeks].reverse().findIndex((w) => w.rate != null);
  const shown = weeks[active ?? (marked.length ? latest : -1)];

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" data-testid="weekly-attendance-chart">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><CalendarCheck size={16} className="shrink-0 text-secondary" /><span className="eyebrow">{t("weekly_attendance_title")}</span></div>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{t("weekly_attendance_hint")}</p>
        </div>
        {/* The readout follows the pointer and keyboard focus, and rests on the latest week. */}
        <div className="shrink-0 text-end" aria-live="polite" data-testid="weekly-attendance-readout">
          <div className="text-2xl font-bold text-primary dark:text-foreground">{shown?.rate != null ? `${Math.round(shown.rate)}%` : "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {shown ? <>{t("week_of")} <span dir="ltr">{shown.week.slice(5)}</span></> : t("no_data")}
          </div>
          {shown && <div className="text-[11px] text-muted-foreground">{shown.marked ? t("attended_of_marked", { attended: shown.attended, marked: shown.marked }) : t("no_register")}</div>}
        </div>
      </div>

      {marked.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("no_register_yet")}</div>
      ) : (
        // Time runs left to right whatever the page direction, as on the progress chart.
        <div className="mt-4" dir="ltr">
          <div className="relative h-36">
            {[100, 50, 0].map((g) => (
              <div key={g} className="absolute inset-x-0 ps-9" style={{ bottom: `${g}%` }}>
                <div className="border-t border-border/70" />
                <span className="absolute left-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">{g}%</span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-end gap-1 ps-9">
              {weeks.map((w, i) => (
                <button key={w.week} type="button" data-testid={`attendance-week-${i}`}
                  aria-label={`${t("week_of")} ${w.week} · ${w.rate != null ? `${Math.round(w.rate)}%` : t("no_register")}`}
                  onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                  className="flex h-full flex-1 cursor-default items-end justify-center rounded-md outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/40">
                  {w.rate == null
                    ? <span className="mb-px h-0.5 w-3 rounded-full bg-muted-foreground/30" />
                    : <span className={`w-full max-w-[24px] rounded-t-[4px] bg-secondary transition-opacity ${active != null && active !== i ? "opacity-40" : ""}`}
                        style={{ height: `${Math.max(w.rate, 1.5)}%` }} />}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex gap-1 ps-9">
            {weeks.map((w) => <span key={w.week} className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground">{w.week.slice(5)}</span>)}
          </div>
          <table className="sr-only">
            <caption>{t("weekly_attendance_title")}</caption>
            <tbody>{weeks.map((w) => <tr key={w.week}><th scope="row">{w.week}</th><td>{w.rate != null ? `${w.rate}%` : t("no_register")}</td><td>{w.marked ? t("attended_of_marked", { attended: w.attended, marked: w.marked }) : ""}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const BANDS = ["EXCELLENT", "STRONG", "DEVELOPING", "NEEDS_WORK", "NO_DATA"];
// Ordered from strongest to weakest, in the tones of the band chips in the table below;
// "no data yet" is a neutral grey because it is not a level at all. Each row is also
// labelled with its word and count, so the colour never carries the meaning alone.
const BAR = {
  EXCELLENT: "bg-emerald-700 dark:bg-green-700",
  STRONG: "bg-emerald-500",
  DEVELOPING: "bg-amber-500 dark:bg-amber-600",
  NEEDS_WORK: "bg-red-700",
  NO_DATA: "bg-slate-300 dark:bg-slate-600",
};

/** Students by Mastery band — how many of the circle sit at each level right now. */
export function BandDistribution({ students = [] }) {
  const { t } = useT();
  const active = students.filter((s) => s.is_active);
  const counts = Object.fromEntries(BANDS.map((b) => [b, active.filter((s) => s.band === b).length]));
  const total = active.length;

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" style={{ animationDelay: "60ms" }} data-testid="band-distribution-chart">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><Users size={16} className="shrink-0 text-secondary" /><span className="eyebrow">{t("band_distribution_title")}</span></div>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{t("band_distribution_hint")}</p>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-2xl font-bold text-primary dark:text-foreground">{total}</div>
          <div className="text-[11px] text-muted-foreground">{t("total_students")}</div>
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("no_students_yet")}</div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {BANDS.map((b) => {
            const n = counts[b];
            const pct = Math.round((n / total) * 100);
            return (
              <li key={b} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 sm:grid-cols-[8rem_1fr_4rem]" data-testid={`band-row-${b}`}
                title={`${t(`band_${b}`)} · ${n} · ${pct}%`}>
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${BAR[b]}`} />
                  <span className="truncate">{t(`band_${b}`)}</span>
                </span>
                {/* Bars grow from the start edge — the right in Arabic — and round only at the data end. */}
                <span className="h-3 overflow-hidden rounded-e-[4px] bg-muted">
                  <span className={`block h-full rounded-e-[4px] transition-[width] duration-700 ${BAR[b]}`} style={{ width: `${pct}%` }} />
                </span>
                <span className={`text-end text-xs tabular-nums ${n ? "" : "text-muted-foreground/60"}`}>
                  <span className="font-semibold">{n}</span>
                  {n > 0 && <span className="text-muted-foreground"> · {pct}%</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
