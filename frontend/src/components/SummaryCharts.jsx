import { useState } from "react";
import { useT } from "../lib/i18n";
import { BAND_FILL, Dash, Panel } from "./ui-kit";

/**
 * The at-a-glance charts on the Supervisor's and the teacher's dashboards and a student's page.
 *
 * None introduces a measure. The attendance bars are the register read day by day or week by
 * week (the API computes them with the same rule as "average attendance"), the donut counts the
 * mistakes the history already lists, the level line is the §3.3 Mastery read session by session,
 * and the distribution counts the Mastery bands the table below already prints beside each
 * student — the same words and the same thresholds (MasteryBand on the server, lib/mastery.js
 * here), not a new grouping. Plain Tailwind and SVG: the web client carries no charting library.
 */

const dayName = (date, locale) => new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en", { weekday: "short", timeZone: "UTC" })
  .format(new Date(`${date}T00:00:00Z`));

/**
 * The attendance rate, one bar a day over the last week or one a week over the last eight —
 * one series, so one colour and no legend; the title names it. It opens on the days, unless
 * no circle met in the last week.
 */
export function AttendanceChart({ days = [], weeks = [] }) {
  const { t, locale } = useT();
  const [view, setView] = useState(days.some((d) => d.rate != null) ? "days" : "weeks");
  const [active, setActive] = useState(null);
  const byDay = view === "days";
  const rows = byDay
    ? days.map((d) => ({ key: d.date, tick: dayName(d.date, locale).replace(/^ال/, ""), rate: d.rate, marked: d.marked, attended: d.attended, name: `${dayName(d.date, locale)} ${d.date.slice(5)}` }))
    : weeks.map((w) => ({ key: w.week, tick: w.week.slice(5), rate: w.rate, marked: w.marked, attended: w.attended, name: `${t("week_of")} ${w.week.slice(5)}` }));
  const marked = rows.filter((r) => r.rate != null);
  const latest = rows.length - 1 - [...rows].reverse().findIndex((r) => r.rate != null);
  const shown = rows[active ?? (marked.length ? latest : -1)];
  const pick = (v) => { setView(v); setActive(null); };

  return (
    <Panel testId="weekly-attendance-chart" title={t(byDay ? "chart_days_title" : "weekly_attendance_title")} hint={t(byDay ? "chart_days_hint" : "weekly_attendance_hint")}
      aside={
        // The readout follows the pointer and keyboard focus, and rests on the latest bar.
        <div className="text-end" aria-live="polite" data-testid="weekly-attendance-readout">
          <div className="text-2xl font-semibold leading-none tabular-nums">{shown?.rate != null ? `${Math.round(shown.rate)}%` : "—"}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{shown ? shown.name : t("no_data")}</div>
          {shown && <div className="text-[11px] text-muted-foreground">{shown.marked ? t("attended_of_marked", { attended: shown.attended, marked: shown.marked }) : t("no_register")}</div>}
        </div>
      }>
      <div className="mb-3 inline-grid grid-cols-2 gap-0.5 rounded-md border border-input bg-background p-0.5" role="radiogroup" aria-label={t("chart_days_title")}>
        {["days", "weeks"].map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => pick(v)} data-testid={`attendance-view-${v}`}
            className={`rounded-[4px] px-3 py-1 text-xs font-semibold transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {t(`chart_view_${v}`)}
          </button>
        ))}
      </div>
      {marked.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("no_register_yet")}</div>
      ) : (
        // Time runs left to right whatever the page direction, as on the progress chart.
        <div dir="ltr">
          <div className="relative h-36">
            {[100, 50, 0].map((g) => (
              <div key={g} className="absolute inset-x-0 ps-9" style={{ bottom: `${g}%` }}>
                <div className="border-t border-border" />
                <span className="absolute left-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">{g}%</span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-end gap-1 ps-9">
              {rows.map((r, i) => (
                <button key={r.key} type="button" data-testid={`attendance-${byDay ? "day" : "week"}-${i}`}
                  aria-label={`${r.name} · ${r.rate != null ? `${Math.round(r.rate)}%` : t("no_register")}`}
                  onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                  className="flex h-full flex-1 cursor-default items-end justify-center rounded-sm outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring/40">
                  {r.rate == null
                    ? <span className="mb-px h-0.5 w-3 rounded-full bg-muted-foreground/30" />
                    : <span className={`w-full max-w-[24px] rounded-t-[4px] bg-secondary transition-opacity ${active != null && active !== i ? "opacity-40" : ""}`}
                        style={{ height: `${Math.max(r.rate, 1.5)}%` }} />}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex gap-1 ps-9">
            {rows.map((r) => <span key={r.key} className="min-w-0 flex-1 whitespace-nowrap text-center text-[9px] tabular-nums text-muted-foreground">{r.tick}</span>)}
          </div>
          <table className="sr-only">
            <caption>{t(byDay ? "chart_days_title" : "weekly_attendance_title")}</caption>
            <tbody>{rows.map((r) => <tr key={r.key}><th scope="row">{r.key}</th><td>{r.rate != null ? `${r.rate}%` : t("no_register")}</td><td>{r.marked ? t("attended_of_marked", { attended: r.attended, marked: r.marked }) : ""}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/**
 * A kind of mistake keeps its colour wherever it appears, in the same family as its chip in the
 * session history. The order keeps red and amber apart, the pair hardest to tell apart (checked
 * with the dataviz palette validator in both modes), and each slice is named with its count in
 * the legend, so the colour never carries the meaning alone.
 */
const ERROR_ORDER = ["MEM_GAP", "TAJ_ERR", "LNK_ERR", "SLF_CRT"];
const ERROR_COLOR = { MEM_GAP: "#DC2626", TAJ_ERR: "#2563EB", LNK_ERR: "#D97706", SLF_CRT: "#059669" };

/** `items`: [{ code, label_ar, label_en, count }]. Hovering a slice or its row picks out its count. */
export function ErrorDonut({ items = [], testId = "chart-errors" }) {
  const { t, locale } = useT();
  const [active, setActive] = useState(null);
  const rows = ERROR_ORDER.map((code) => items.find((i) => i.code === code)).filter(Boolean);
  const total = rows.reduce((n, r) => n + r.count, 0);
  const R = 38, C = 2 * Math.PI * R, GAP = rows.length > 1 ? 1.5 : 0;
  const shown = rows.find((r) => r.code === active);
  let start = 0;

  return (
    <Panel testId={testId} title={t("chart_errors_title")} hint={t("chart_errors_hint")}>
      {!total ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("chart_errors_empty")}</div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-5">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={t("chart_errors_title")}>
              {rows.map((r) => {
                const len = (r.count / total) * C;
                const slice = (
                  <circle key={r.code} cx="50" cy="50" r={R} fill="none" stroke={ERROR_COLOR[r.code]} strokeWidth="13"
                    strokeDasharray={`${Math.max(len - GAP, 0.5)} ${C}`} strokeDashoffset={-start}
                    opacity={active && active !== r.code ? 0.25 : 1} className="transition-opacity"
                    onMouseEnter={() => setActive(r.code)} onMouseLeave={() => setActive(null)} />
                );
                start += len;
                return slice;
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center" aria-live="polite">
              <div className="text-xl font-semibold leading-none tabular-nums">{shown ? shown.count : total}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{t("chart_errors_total")}</div>
            </div>
          </div>
          <ul className="min-w-40 flex-1 space-y-2 text-xs">
            {rows.map((r) => (
              <li key={r.code} className="flex items-center gap-2" onMouseEnter={() => setActive(r.code)} onMouseLeave={() => setActive(null)} data-testid={`error-share-${r.code}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ERROR_COLOR[r.code] }} />
                <span className="flex-1 font-medium">{locale === "ar" ? r.label_ar : r.label_en}</span>
                <span className="font-semibold tabular-nums">{r.count}</span>
                <span className="w-9 text-end tabular-nums text-muted-foreground" dir="ltr">{Math.round((r.count / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// A level that moved by less than three points is steady, as in trendDirection() on the server.
const direction = (points) => {
  const delta = points[points.length - 1].level - points[0].level;
  return delta > 3 ? "UP" : delta < -3 ? "DOWN" : "STEADY";
};
const LINE_TONE = { UP: "text-success", DOWN: "text-destructive", STEADY: "text-muted-foreground" };

const linePoints = (points, W, H, pad) => points.map((p, i) => [
  pad + (i * (W - 2 * pad)) / Math.max(points.length - 1, 1),
  H - pad - (p.level / 100) * (H - 2 * pad),
]);

/** The small line in a table row: rising or falling, at a glance. */
export function Sparkline({ points = [] }) {
  const { t } = useT();
  if (points.length < 2) return <Dash />;
  const dir = direction(points);
  const xy = linePoints(points, 80, 26, 3);
  const [ex, ey] = xy[xy.length - 1];
  const label = `${t("chart_level_short")}: ${points[0].level} → ${points[points.length - 1].level} · ${t(`trend_${dir}`)}`;
  return (
    <span className={`inline-block align-middle ${LINE_TONE[dir]}`} dir="ltr" title={label} data-testid="level-sparkline" data-direction={dir}>
      <svg viewBox="0 0 80 26" className="h-[26px] w-20" role="img" aria-label={label}>
        <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={ex} cy={ey} r="3" fill="currentColor" />
      </svg>
    </span>
  );
}

/** The same line at full size on a student's page: the level after each of the last 8 sessions. */
export function LevelLine({ points = [] }) {
  const { t } = useT();
  const [active, setActive] = useState(null);
  const W = 320, H = 130, PAD = 16;
  const dir = points.length >= 2 ? direction(points) : null;
  const xy = linePoints(points, W, H, PAD);
  const shown = points[active ?? points.length - 1];

  return (
    <Panel testId="chart-level" title={t("chart_level_title")}
      aside={dir && (
        <div className="text-end" aria-live="polite">
          <div className="text-2xl font-semibold leading-none tabular-nums">{shown.level}</div>
          <div className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{shown.date}</div>
          <div className={`text-[11px] font-semibold ${LINE_TONE[dir]}`} data-testid="level-direction">{t(`trend_${dir}`)}</div>
        </div>
      )}>
      {!dir ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("chart_level_empty")}</div>
      ) : (
        <div dir="ltr" className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("chart_level_title")}>
            {[0, 50, 100].map((v) => {
              const y = H - PAD - (v / 100) * (H - 2 * PAD);
              return (
                <g key={v}>
                  <line x1="0" x2={W} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />
                  <text x="0" y={y - 3} fontSize="9" fill="hsl(var(--muted-foreground))">{v}</text>
                </g>
              );
            })}
            <polyline points={xy.map((p) => p.join(",")).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="2" opacity={active != null && active !== i ? 0.4 : 1} />)}
          </svg>
          <div className="absolute inset-0 flex">
            {points.map((p, i) => (
              <button key={p.date} type="button" aria-label={`${p.date} · ${p.level}`} className="flex-1 cursor-default outline-none"
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

const BANDS = ["EXCELLENT", "STRONG", "DEVELOPING", "NEEDS_WORK", "NO_DATA"];
// Ordered from strongest to weakest. The fills are the band tokens (BAND_FILL), checked with
// the dataviz palette validator in both modes; "no data yet" is neutral because it is not a
// level at all. Each row is also labelled with its word and count, so the colour never
// carries the meaning alone.

/** Students by Mastery band — how many of the circle sit at each level right now. */
export function BandDistribution({ students = [] }) {
  const { t } = useT();
  const active = students.filter((s) => s.is_active);
  const counts = Object.fromEntries(BANDS.map((b) => [b, active.filter((s) => s.band === b).length]));
  const total = active.length;

  return (
    <Panel testId="band-distribution-chart" title={t("band_distribution_title")} hint={t("band_distribution_hint")}
      aside={
        <div className="text-end">
          <div className="text-2xl font-semibold leading-none tabular-nums">{total}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{t("total_students")}</div>
        </div>
      }>
      {total === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("no_students_yet")}</div>
      ) : (
        <ul className="space-y-3">
          {BANDS.map((b) => {
            const n = counts[b];
            const pct = Math.round((n / total) * 100);
            return (
              <li key={b} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 sm:grid-cols-[8rem_1fr_4rem]" data-testid={`band-row-${b}`}
                title={`${t(`band_${b}`)} · ${n} · ${pct}%`}>
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${BAND_FILL[b]}`} />
                  <span className="truncate">{t(`band_${b}`)}</span>
                </span>
                {/* Bars grow from the start edge — the right in Arabic — and round only at the data end. */}
                <span className="h-2.5 overflow-hidden rounded-e-[4px] bg-muted">
                  <span className={`block h-full rounded-e-[4px] transition-[width] duration-700 ${BAND_FILL[b]}`} style={{ width: `${pct}%` }} />
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
    </Panel>
  );
}
