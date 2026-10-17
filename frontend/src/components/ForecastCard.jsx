import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, ChevronDown, Info, RefreshCw, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { useT } from "../lib/i18n";
import { btnGhost, inputCls } from "./ui-kit";

const JUZ = Array.from({ length: 30 }, (_, i) => i + 1);
const PACES = ["recorded", "new", "review", "fast"];

/**
 * The expected completion date (FR10), shared by the student's page and the staff view.
 * When the forecasting service is down the last stored forecast is shown with a notice
 * that it may be out of date (UC13), rather than no forecast at all.
 *
 * Under it, the assumptions the supervisor's review asked for: a target scope (the current
 * Juz, the whole Quran, or a range of Juz) and, for staff, a baseline pace for a student whose
 * history is still too short to have one. They are request parameters to the API, which puts
 * the question to the ML service and falls back to remaining pages ÷ pace when it cannot be
 * reached. Nothing is saved: the stored forecast above is never replaced by a what-if.
 */
export function ForecastCard({ pred, onRefresh, studentId, canSetPace = false }) {
  const { t } = useT();
  const p = pred?.prediction;
  const a = pred?.assumptions;
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("current");
  const [range, setRange] = useState(null);
  const [pace, setPace] = useState("recorded");
  const [scenario, setScenario] = useState(null);
  const [busy, setBusy] = useState(false);

  const current = a?.current_juz ?? 1;
  const from = scope === "quran" ? 1 : scope === "range" ? range?.[0] ?? current : current;
  const to = scope === "quran" ? 30 : scope === "range" ? range?.[1] ?? Math.min(current + 2, 30) : current;
  const isDefault = scope === "current" && pace === "recorded";
  const sparse = a && a.sessions_count < a.min_sessions;

  useEffect(() => {
    if (!open || isDefault || !studentId) { setScenario(null); return undefined; }
    let live = true;
    setBusy(true);
    api.get(`/students/${studentId}/prediction`, { params: { scope_from: from, scope_to: to, pace } })
      .then((r) => { if (live) setScenario(r.data.scenario); })
      .catch(() => { if (live) setScenario(null); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [open, isDefault, studentId, from, to, pace]);

  const paceLabel = (k) => k === "recorded"
    ? `${t("pace_recorded")} — ${a?.recorded_pace ?? 0} ${t("pages_per_week")}`
    : `${t(`pace_${k}`)} — ${a?.paces?.[k]} ${t("pages_per_week")}`;
  const pickScope = (s) => {
    setScope(s);
    if (s === "range" && !range) setRange([current, Math.min(current + 2, 30)]);
  };

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 animate-rise" data-testid="forecast-card">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">{t("forecast")}</div>
        {onRefresh && <button data-testid="refresh-forecast-button" className={`${btnGhost} !px-2 !py-1 text-xs`} onClick={onRefresh}><RefreshCw size={12} />{t("refresh_forecast")}</button>}
      </div>
      {!p ? (
        <div className="mt-3 text-sm text-muted-foreground">{t("forecast_none")}</div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            <CalendarClock className="shrink-0 text-secondary" />
            <div>
              {/* The model version and the generation timestamp are diagnostics for the
                  prediction service, not something a student or parent needs to read. */}
              <div className="font-mono text-2xl font-semibold text-primary" dir="ltr" data-testid="forecast-date">{p.predicted_completion_date}</div>
              <div className="text-xs text-muted-foreground">{t("forecast_eta", { days: p.eta_days })}</div>
            </div>
          </div>
          {pred.stale && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" data-testid="forecast-stale-notice">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />{t("forecast_stale")}
            </div>
          )}
        </>
      )}

      {a && (
        <>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/70 bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground" data-testid="forecast-caveat">
            <Info size={14} className="mt-0.5 shrink-0 text-secondary" />
            <div>
              <div>{t("forecast_caveat", { n: a.min_sessions })}</div>
              {sparse && <div className="mt-1 font-semibold text-amber-700 dark:text-amber-400" data-testid="forecast-sparse">{t("forecast_sparse", { n: a.sessions_count, min: a.min_sessions })}</div>}
            </div>
          </div>

          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="assumptions-toggle"
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-primary/5">
            <span className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-secondary" />{t("assumptions")}</span>
            <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="mt-3 space-y-4 animate-rise" data-testid="assumptions-panel">
              <div>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("forecast_scope")}</div>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1" role="radiogroup" aria-label={t("forecast_scope")}>
                  {["current", "quran", "range"].map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => pickScope(s)} data-testid={`scope-${s}`}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${scope === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>
                      {t(`scope_${s}`)}
                    </button>
                  ))}
                </div>
                {scope === "range" && range && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{t("scope_from_juz")}</span>
                    <select className={`${inputCls} !w-auto !py-1.5`} value={range[0]} data-testid="scope-from"
                      onChange={(e) => { const f = Number(e.target.value); setRange([f, Math.max(f, range[1])]); }}>
                      {JUZ.map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                    <span className="text-muted-foreground">{t("scope_to_juz")}</span>
                    <select className={`${inputCls} !w-auto !py-1.5`} value={range[1]} data-testid="scope-to"
                      onChange={(e) => setRange([range[0], Number(e.target.value)])}>
                      {JUZ.filter((j) => j >= range[0]).map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {canSetPace && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{t("baseline_pace")}</span>
                  <select className={inputCls} value={pace} onChange={(e) => setPace(e.target.value)} data-testid="pace-select">
                    {PACES.map((k) => <option key={k} value={k}>{paceLabel(k)}</option>)}
                  </select>
                  <span className={`mt-1 block text-[11px] ${sparse ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {sparse ? t("baseline_pace_sparse_hint") : t("baseline_pace_hint")}
                  </span>
                </label>
              )}

              {!isDefault && (
                <div className={`rounded-xl border border-secondary/30 bg-secondary/5 p-3 transition-opacity ${busy ? "opacity-60" : ""}`} data-testid="scenario-result" aria-live="polite">
                  <div className="text-[11px] font-semibold text-muted-foreground">{from === to ? t("scenario_title_one", { juz: from }) : t("scenario_title", { from, to })}</div>
                  {!scenario ? (
                    <div className="mt-1 text-sm text-muted-foreground">{t("loading")}</div>
                  ) : scenario.remaining_pages <= 0 ? (
                    <div className="mt-1 text-sm font-semibold text-primary dark:text-foreground">{t("scenario_already_done")}</div>
                  ) : scenario.eta_days == null ? (
                    <div className="mt-1 text-sm text-muted-foreground">{t("scenario_no_pace")}</div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-xl font-semibold text-primary dark:text-foreground" dir="ltr" data-testid="scenario-date">{scenario.predicted_completion_date}</span>
                      <span className="text-xs text-muted-foreground">{t("forecast_eta", { days: scenario.eta_days })}</span>
                    </div>
                  )}
                  {scenario?.eta_days > 0 && (
                    <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {t("scenario_basis", { pages: scenario.remaining_pages, pace: scenario.pages_per_week })}
                      <span className="mx-1">·</span>
                      <span data-testid="scenario-source">{t(`scenario_source_${scenario.source}`)}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">{t("assumptions_not_saved")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
