import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useT } from "../lib/i18n";
import { BAND_FLOORS, bandFor } from "../lib/mastery";

export function PageTitle({ title, subtitle, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border pb-5 sm:mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-semibold leading-tight text-foreground sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

/** A titled sheet. The title row is ruled off from the body, as a section of a register is. */
export function Panel({ title, hint, aside, children, className = "", bodyClassName = "p-4 sm:p-5", testId }) {
  return (
    <section className={`panel rounded-lg ${className}`} data-testid={testId}>
      {(title || aside) && (
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="panel-title">{title}</h2>}
            {hint && <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">{hint}</p>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** One frame for a row of figures; `.figures` draws the hairlines between the cells. */
export function Figures({ className = "", children, testId }) {
  return <div className={`figures ${className}`} data-testid={testId}>{children}</div>;
}

/**
 * A number with the phrase that says what it measures.
 *
 * `hint` is the one-line explanation, shown under the label on wide cells and behind a
 * question mark on compact ones. Every measured figure in the app carries one: the metric
 * names the analytics module uses — mastery, momentum, precision, consistency, review
 * depth — mean nothing to a teacher or a child until someone says what they count.
 * Render it inside <Figures>, which supplies the frame.
 */
export function MetricCard({ label, value, unit, hint, testId, accent, compact, className = "" }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={testId} className={`min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="eyebrow">{label}</div>
        {hint && compact && (
          <button type="button" aria-label={t("what_does_it_mean")} aria-expanded={open} onClick={() => setOpen(!open)}
            className="-m-1 shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground" data-testid={testId ? `${testId}-hint` : undefined}>
            <HelpCircle size={14} />
          </button>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`metric-number ${accent ? "!text-gold-ink" : ""} ${value == null ? "!text-muted-foreground/50" : ""}`}>{value ?? "—"}</span>
        {/* A dash carries no unit: "— %" reads as a broken number rather than "nothing yet". */}
        {unit && value != null && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && (!compact || open) && <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** The Mastery bands as fills, spelled out so Tailwind keeps every class. */
export const BAND_FILL = {
  EXCELLENT: "bg-band-EXCELLENT",
  STRONG: "bg-band-STRONG",
  DEVELOPING: "bg-band-DEVELOPING",
  NEEDS_WORK: "bg-band-NEEDS_WORK",
  NO_DATA: "bg-band-NO_DATA",
};

/**
 * The headline figure, with the same word the parent report prints so the two never disagree.
 *
 * Under the number sits the 0–100 scale cut at the band floors from lib/mastery.js, so the
 * word and the position on the scale come from the same thresholds as the server's.
 */
export function MasteryGauge({ value, testId = "mastery-score-card", className = "" }) {
  const { t } = useT();
  const band = bandFor(value);
  const cuts = [0, BAND_FLOORS.DEVELOPING, BAND_FLOORS.STRONG, BAND_FLOORS.EXCELLENT, 100];
  const order = ["NEEDS_WORK", "DEVELOPING", "STRONG", "EXCELLENT"];
  return (
    <div data-testid={testId} className={`min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow">{t("mastery")}</div>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <span className={`h-2 w-2 shrink-0 rounded-full ${BAND_FILL[band]}`} aria-hidden="true" />
          <span data-testid="mastery-band">{t(`band_${band}`)}</span>
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={`metric-number sm:!text-[44px] ${value == null ? "!text-muted-foreground/50" : ""}`}>{value ?? "—"}</span>
        {value != null && <span className="text-sm text-muted-foreground">/100</span>}
      </div>
      <div className="relative mt-4" aria-hidden="true">
        <div className="flex h-1.5 gap-[2px]">
          {order.map((b, i) => (
            <span key={b} className={`h-full first:rounded-s-full last:rounded-e-full ${BAND_FILL[b]} ${b === band ? "" : "opacity-25"}`}
              style={{ width: `${cuts[i + 1] - cuts[i]}%` }} />
          ))}
        </div>
        {value != null && (
          <span className="absolute -top-1 h-3.5 w-[3px] -translate-x-1/2 rounded-full bg-foreground ring-2 ring-card rtl:translate-x-1/2"
            style={{ insetInlineStart: `${Math.min(100, Math.max(0, value))}%` }} />
        )}
        <div className="relative mt-1.5 h-3 text-[10px] tabular-nums text-muted-foreground">
          {cuts.slice(1, -1).map((c) => (
            <span key={c} className="absolute -translate-x-1/2 rtl:translate-x-1/2" style={{ insetInlineStart: `${c}%` }}>{c}</span>
          ))}
        </div>
      </div>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{t("mastery_hint")}</p>
    </div>
  );
}

/**
 * The rising-or-falling picture, as two strips that share one time axis.
 *
 * The top strip is the level reached by the end of each week, on its own 0–100 scale; the
 * bottom one is the pages covered that week. They used to share one frame, which read as
 * one scale when they are two — a page count and a score — so each now has its own.
 */
export function TrendChart({ trend, summary, testId = "trend-chart" }) {
  const { t } = useT();
  const [active, setActive] = useState(null);
  const rows = (trend || []).slice(-12);
  if (rows.length < 2) return null;

  const n = rows.length, maxPages = Math.max(0.5, ...rows.map((r) => r.pages));
  const x = (i) => ((i + 0.5) / n) * 100;
  const y = (r) => 100 - (r.level ?? 0);
  const shown = rows[active ?? n - 1];
  const dir = summary?.direction || "NEW";
  const tone = { UP: "text-success", DOWN: "text-destructive", STEADY: "text-muted-foreground", NEW: "text-muted-foreground" }[dir];

  return (
    <Panel testId={testId} title={t("trend_title")} hint={t("trend_hint")}
      aside={<span className={`chip !min-h-0 border-border bg-background font-semibold ${tone}`} data-testid="trend-direction">{t(`trend_${dir}`)}</span>}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
        <span>{t("week_of")} <span dir="ltr" className="tabular-nums">{shown.week}</span></span>
        <span>{t("trend_level")} <b className="font-semibold tabular-nums text-foreground">{shown.level ?? "—"}</b></span>
        <span>{t("trend_pages")} <b className="font-semibold tabular-nums text-foreground">{shown.pages}</b></span>
      </div>

      {/* Always left-to-right: the horizontal axis is time, and time does not mirror with the page. */}
      <div className="relative mt-4" dir="ltr">
        <div className="mb-1.5 ps-8 text-[11px] font-medium text-muted-foreground">{t("trend_level")}</div>
        <div className="relative ms-8 h-28">
          {[100, 50, 0].map((g) => (
            <div key={g} className="absolute inset-x-0" style={{ top: `${100 - g}%` }}>
              <div className="border-t border-dashed border-border" />
              <span className="absolute -left-8 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">{g}</span>
            </div>
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={t("trend_level")}>
            <polyline points={rows.map((r, i) => `${x(i)},${y(r)}`).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {rows.map((r, i) => (
            <span key={r.week} className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card transition-transform ${active === i ? "scale-150" : ""}`}
              style={{ left: `${x(i)}%`, top: `${y(r)}%` }} />
          ))}
        </div>

        <div className="mb-1.5 mt-5 ps-8 text-[11px] font-medium text-muted-foreground">{t("trend_pages")}</div>
        <div className="relative ms-8 flex h-12 items-end gap-[2px] border-b border-border">
          <span className="absolute -left-8 top-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground">{Math.round(maxPages * 10) / 10}</span>
          {rows.map((r, i) => (
            <span key={r.week} className="flex h-full flex-1 items-end justify-center">
              <span className={`w-full max-w-[22px] rounded-t-[4px] bg-secondary transition-opacity ${active != null && active !== i ? "opacity-35" : ""}`}
                style={{ height: `${r.pages ? Math.max((r.pages / maxPages) * 100, 4) : 0}%` }} />
            </span>
          ))}
        </div>

        <div className="ms-8 mt-1.5 flex">
          {rows.map((r) => <span key={r.week} className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground">{r.week.slice(5)}</span>)}
        </div>

        {/* One hit column per week across both strips, wider than the marks it reads out. */}
        <div className="absolute inset-y-0 left-8 right-0 flex">
          {rows.map((r, i) => (
            <button key={r.week} type="button" tabIndex={0}
              aria-label={`${t("week_of")} ${r.week} · ${t("trend_level")} ${r.level ?? "—"} · ${t("trend_pages")} ${r.pages}`}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
              className={`flex-1 cursor-default rounded-sm transition-colors ${active === i ? "bg-foreground/[0.04]" : ""}`} />
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>{t("trend_title")}</caption>
        <tbody>{rows.map((r) => <tr key={r.week}><th scope="row">{r.week}</th><td>{r.level ?? "—"}</td><td>{r.pages}</td></tr>)}</tbody>
      </table>
    </Panel>
  );
}

/**
 * A student nobody has recorded a session for yet. Their figures are not zero — they do not
 * exist — so the tables show this badge and a dash instead of a row of 0, 0% and 0.00.
 */
export function NewBadge({ testId, className = "ms-2" }) {
  const { t } = useT();
  return (
    <span data-testid={testId} title={t("new_student_hint")}
      className={`${className} inline-flex items-center rounded-sm border border-primary/30 bg-primary/[0.06] px-1.5 py-px align-middle text-[11px] font-semibold text-primary`}>
      {t("new_student_badge")}
    </span>
  );
}

/** The quiet dash that stands in for a figure that does not exist yet. */
export function Dash() {
  const { t } = useT();
  return <span className="text-muted-foreground/60" title={t("no_data")}>—</span>;
}

export const ERROR_STYLES = {
  MEM_GAP: "border-destructive/35 bg-destructive/[0.07] text-destructive",
  LNK_ERR: "border-warning/35 bg-warning/[0.07] text-warning",
  TAJ_ERR: "border-primary/30 bg-primary/[0.06] text-primary",
  SLF_CRT: "border-success/35 bg-success/[0.07] text-success",
};
export const ATT_STYLES = {
  P: "border-success/35 bg-success/[0.08] text-success",
  A: "border-destructive/35 bg-destructive/[0.08] text-destructive",
  E: "border-border bg-muted text-muted-foreground",
  // Legacy rows only: the register no longer offers "late". Shown as present, which is how
  // every teacher interviewed already treated it.
  L: "border-success/35 bg-success/[0.08] text-success",
};

/** A tagged note on the recitation. The severity weight behind it is never printed here. */
export function ErrorChip({ type, ayahRef, onRemove, testId }) {
  const { locale } = useT();
  if (!type) return null;
  return (
    <span data-testid={testId} className={`chip !min-h-0 ${ERROR_STYLES[type.code]}`}>
      {locale === "ar" ? type.label_ar : type.label_en}{ayahRef && <span className="font-mono opacity-70">{ayahRef}</span>}
      {onRemove && <button type="button" aria-label="×" onClick={onRemove} className="ms-1 opacity-60 hover:opacity-100">×</button>}
    </span>
  );
}

export const Field = ({ label, children, hint, testId }) => (
  <label className="block text-sm" data-testid={testId}>
    <span className="mb-1.5 block text-[13px] font-medium text-foreground/80">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
  </label>
);
export const inputCls = "w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus:border-primary focus:ring-[3px] focus:ring-primary/15";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted";
export const btnDanger = "inline-flex items-center justify-center gap-2 rounded-md border border-destructive/40 bg-card px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/[0.06]";

export function Table({ head, children, testId, empty }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="panel overflow-x-auto rounded-lg" data-testid={testId}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-start">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70 [&>tr:hover]:bg-muted/30 [&>tr]:transition-colors">
          {hasRows ? children : <tr><td colSpan={head.length} className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, wide }) {
  const { t } = useT();
  // Escape closes the dialog, as it does everywhere else on the web.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} data-testid="modal"
        className={`panel my-auto w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-lg shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]`}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="panel-title text-lg">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="-m-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Anything irreversible asks first, and says in words what is about to go. */
export function ConfirmDialog({ open, title, message, onCancel, onConfirm, confirmLabel }) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground" data-testid="confirm-message">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel} data-testid="confirm-cancel">{t("cancel")}</button>
        <button type="button" className={btnDanger} onClick={onConfirm} data-testid="confirm-ok">{confirmLabel || t("delete")}</button>
      </div>
    </Modal>
  );
}
