import { useT } from "../lib/i18n";

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div><h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary dark:text-foreground">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function MetricCard({ label, value, unit, hint, testId, accent, delay = 0 }) {
  return (
    <div data-testid={testId} className="glass rounded-2xl p-4 sm:p-5 animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="eyebrow">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`metric-number ${accent ? "!text-gold" : ""}`}>{value ?? "—"}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function MasteryGauge({ value, testId = "mastery-score-card" }) {
  const { t } = useT();
  const v = value ?? 0, r = 54, c = 2 * Math.PI * r, dash = (v / 100) * c * 0.75;
  return (
    <div data-testid={testId} className="glass rounded-2xl p-4 sm:p-5 flex items-center gap-4 animate-rise">
      <svg viewBox="0 0 128 128" className="h-28 w-28 -rotate-[135deg] shrink-0">
        <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeDasharray={`${c * 0.75} ${c}`} strokeLinecap="round" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={v >= 80 ? "#10B981" : v >= 50 ? "#D97706" : "#DC2626"} strokeWidth="12" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <div><div className="eyebrow">{t("mastery")}</div><div className="metric-number">{value ?? "—"}<span className="text-base text-muted-foreground">/100</span></div></div>
    </div>
  );
}

export const ERROR_STYLES = {
  MEM_GAP: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  LNK_ERR: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  TAJ_ERR: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  SLF_CRT: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
};
export const ATT_STYLES = { P: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", A: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", L: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", E: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30" };

export function ErrorChip({ type, ayahRef, onRemove, testId }) {
  const { locale } = useT();
  return (
    <span data-testid={testId} className={`chip !min-h-0 ${ERROR_STYLES[type.code]}`}>
      {locale === "ar" ? type.label_ar : type.label_en} <span className="font-mono opacity-70">{Number(type.weight).toFixed(2)}</span>{ayahRef && <span className="font-mono">{ayahRef}</span>}
      {onRemove && <button type="button" onClick={onRemove} className="ms-1 opacity-60 hover:opacity-100">×</button>}
    </span>
  );
}

export const Field = ({ label, children, testId }) => <label className="block text-sm" data-testid={testId}><span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
export const inputCls = "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/10";

export function Table({ head, children, testId }) {
  return (
    <div className="glass overflow-x-auto rounded-2xl" data-testid={testId}>
      <table className="w-full text-sm">
        <thead><tr className="text-start text-xs text-muted-foreground">{head.map((h, i) => <th key={i} className="px-4 py-3 text-start font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass w-full max-w-md rounded-2xl p-5 animate-rise" onClick={(e) => e.stopPropagation()} data-testid="modal">
        <h3 className="mb-4 text-lg font-bold">{title}</h3>{children}
      </div>
    </div>
  );
}
