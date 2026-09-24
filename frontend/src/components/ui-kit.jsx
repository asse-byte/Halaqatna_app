import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useT } from "../lib/i18n";
import { bandFor } from "../lib/mastery";

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary dark:text-foreground">{title}</h1>{subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/**
 * A number with the phrase that says what it measures.
 *
 * `hint` is the one-line explanation, shown under the label on wide cards and behind a
 * question mark on compact ones. Every measured figure in the app carries one: the metric
 * names the analytics module uses — mastery, momentum, precision, consistency, review
 * depth — mean nothing to a teacher or a child until someone says what they count.
 */
export function MetricCard({ label, value, unit, hint, testId, accent, delay = 0, compact }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={testId} className="glass rounded-2xl p-4 sm:p-5 animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="eyebrow">{label}</div>
        {hint && compact && (
          <button type="button" aria-label={t("what_does_it_mean")} onClick={() => setOpen(!open)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-primary" data-testid={testId ? `${testId}-hint` : undefined}>
            <HelpCircle size={14} />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`metric-number ${accent ? "!text-gold" : ""}`}>{value ?? "—"}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && (!compact || open) && <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  );
}


/** The headline figure, with the same word the parent report prints so the two never disagree. */
export function MasteryGauge({ value, testId = "mastery-score-card" }) {
  const { t } = useT();
  const v = value ?? 0, r = 54, c = 2 * Math.PI * r, dash = (v / 100) * c * 0.75;
  return (
    <div data-testid={testId} className="glass rounded-2xl p-4 sm:p-5 flex items-center gap-4 animate-rise">
      <svg viewBox="0 0 128 128" className="h-28 w-28 -rotate-[135deg] shrink-0" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeDasharray={`${c * 0.75} ${c}`} strokeLinecap="round" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={v >= 80 ? "#10B981" : v >= 50 ? "#D97706" : "#DC2626"} strokeWidth="12" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <div>
        <div className="eyebrow">{t("mastery")}</div>
        <div className="metric-number">{value ?? "—"}<span className="text-base text-muted-foreground">/100</span></div>
        <div className="mt-1 text-sm font-semibold text-secondary" data-testid="mastery-band">{t(`band_${bandFor(value)}`)}</div>
        <div className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">{t("mastery_hint")}</div>
      </div>
    </div>
  );
}

/**
 * The rising-or-falling picture.
 *
 * Bars are the pages covered that week; the line is the level reached by the end of it. The
 * line climbs when the student covers ground with fewer mistakes and drops when it slips,
 * which is the trend a paper register cannot show at all.
 */
export function TrendChart({ trend, summary, testId = "trend-chart" }) {
  const { t } = useT();
  const rows = (trend || []).slice(-12);
  if (rows.length < 2) return null;

  const W = 100, H = 46, maxPages = Math.max(0.5, ...rows.map((r) => r.pages));
  const step = W / rows.length;
  const points = rows
    .map((r, i) => [i * step + step / 2, H - ((r.level ?? 0) / 100) * (H - 4) - 2])
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const dir = summary?.direction || "NEW";
  const tone = { UP: "text-emerald-600 dark:text-emerald-400", DOWN: "text-red-600 dark:text-red-400", STEADY: "text-muted-foreground", NEW: "text-muted-foreground" }[dir];

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="eyebrow">{t("trend_title")}</div>
          <div className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{t("trend_hint")}</div>
        </div>
        <span className={`chip !min-h-0 border-border text-xs font-semibold ${tone}`} data-testid="trend-direction">{t(`trend_${dir}`)}</span>
      </div>

      {/* Always left-to-right: the horizontal axis is time, and time does not mirror with the page. */}
      <div className="mt-4" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={t("trend_title")}>
          {rows.map((r, i) => {
            const h = (r.pages / maxPages) * (H - 6);
            return <rect key={r.week} x={i * step + step * 0.22} y={H - h} width={step * 0.56} height={Math.max(h, 0.6)} rx="0.8" className="fill-secondary/25" />;
          })}
          <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {rows.map((r, i) => (
            <circle key={r.week} cx={i * step + step / 2} cy={H - ((r.level ?? 0) / 100) * (H - 4) - 2} r="1.1"
              className="fill-primary" vectorEffect="non-scaling-stroke">
              <title>{`${r.week} · ${t("trend_level")} ${r.level ?? "—"} · ${t("trend_pages")} ${r.pages}`}</title>
            </circle>
          ))}
        </svg>
        <div className="mt-1 flex text-[9px] text-muted-foreground">
          {rows.map((r) => <span key={r.week} className="flex-1 text-center">{r.week.slice(5)}</span>)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-secondary/25" />{t("trend_pages")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded-sm bg-primary" />{t("trend_level")}</span>
      </div>
    </div>
  );
}

export const ERROR_STYLES = {
  MEM_GAP: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  LNK_ERR: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  TAJ_ERR: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  SLF_CRT: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
};
export const ATT_STYLES = {
  P: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  A: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  E: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
  // Legacy rows only: the register no longer offers "late". Shown as present, which is how
  // every teacher interviewed already treated it.
  L: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
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
    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
  </label>
);
export const inputCls = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/10";
export const btnDanger = "inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10";

export function Table({ head, children, testId, empty }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="glass overflow-x-auto rounded-2xl" data-testid={testId}>
      <table className="w-full text-sm">
        <thead><tr className="text-start text-xs text-muted-foreground">{head.map((h, i) => <th key={i} className="px-4 py-3 text-start font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border/60">
          {hasRows ? children : <tr><td colSpan={head.length} className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, wide }) {
  // Escape closes the dialog, as it does everywhere else on the web.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`glass my-auto w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-2xl p-5 animate-rise`} onClick={(e) => e.stopPropagation()} data-testid="modal">
        <h3 className="text-lg font-bold">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        <div className="mt-4">{children}</div>
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
