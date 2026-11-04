import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Info, RefreshCw, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { useT } from "../lib/i18n";
import { longDate } from "../lib/dates";
import { btnGhost, inputCls, Panel } from "./ui-kit";

const JUZ = Array.from({ length: 30 }, (_, i) => i + 1);
const PACES = ["recorded", "new", "review", "fast"];

/**
 * The expected completion date (FR10), shared by the student's page and the staff view.
 * When the forecasting service is down the last stored forecast is shown with a notice
 * that it may be out of date (UC13), rather than no forecast at all.
 *
 * A date alone invites two wrong readings: that it is the whole Quran, and that it is as
 * reliable after two sessions as after twenty. So it always says which Juz it covers, warns
 * while the data is thin, and states what it assumes in this student's own figures. A capped
 * forecast means "no measurable pace yet" and is not printed as a date ten years away.
 *
 * Under that, the what-if the supervisor's review asked for: a target scope (the current Juz,
 * the whole Quran, or a range of Juz) and, for staff, a baseline pace for a student whose
 * history is still too short to have one. They are request parameters to the API, which puts
 * the question to the ML service and falls back to remaining pages ÷ pace when it cannot be
 * reached. Nothing is saved: the stored forecast above is never replaced by a what-if.
 */
export function ForecastCard({ pred, onRefresh, studentId, canSetPace = false }) {
  const { t, locale } = useT();
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
  const dated = p && !a?.no_estimate;

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
    <Panel testId="forecast-card" title={t("forecast")}
      aside={onRefresh && <button data-testid="refresh-forecast-button" className={`${btnGhost} !px-2 !py-1 text-xs`} onClick={onRefresh}><RefreshCw size={12} />{t("refresh_forecast")}</button>}>
      {!dated ? (
        <div className="text-sm text-muted-foreground" data-testid="forecast-none">{t("forecast_none")}</div>
      ) : (
        <>
          {/* The model version and the generation timestamp are diagnostics for the
              prediction service, not something a student or parent needs to read. */}
          <div className="text-[26px] font-semibold leading-tight tabular-nums" title={p.predicted_completion_date} data-testid="forecast-date">{longDate(p.predicted_completion_date, locale)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{t("forecast_eta", { days: p.eta_days })}</div>
          {pred.stale && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/35 bg-warning/[0.07] p-2.5 text-xs text-warning" data-testid="forecast-stale-notice">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />{t("forecast_stale")}
            </div>
          )}
        </>
      )}

      {a && (
        <>
          {dated && (
            <>
              {/* A note in the margin of the forecast, as a teacher pencils one beside a figure. */}
              <div className="mt-4 border-s-2 border-secondary/50 ps-3 text-xs leading-relaxed text-muted-foreground" data-testid="forecast-caveat">
                <div>{t("forecast_covers", { juz: a.juz })}</div>
                {a.cold_start && <div className="mt-1 font-semibold text-warning" data-testid="forecast-sparse">{t("forecast_sparse", { n: a.attended_sessions, min: a.min_sessions })}</div>}
              </div>

              <div className="mt-4 rounded-md border border-border bg-muted/40 p-3" data-testid="forecast-assumptions">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold"><Info size={14} strokeWidth={1.75} className="text-muted-foreground" />{t("assumptions_title")}</div>
                <ul className="mt-1.5 list-disc space-y-1 ps-4 text-xs leading-relaxed text-muted-foreground">
                  <li>{t("assume_scope", { juz: a.juz, remaining: a.remaining_pages, total: a.pages_per_juz })}</li>
                  <li>{t("assume_commitment", { pct: a.attendance_pct, per_week: a.sessions_per_week ?? "—" })}</li>
                  {a.pace_pages_per_week !== null && <li>{t("assume_pace", { pace: a.pace_pages_per_week })}</li>}
                  <li>{t("assume_limits")}</li>
                </ul>
              </div>
            </>
          )}

          <div className="-mx-4 -mb-4 mt-4 border-t border-border sm:-mx-5 sm:-mb-5">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="assumptions-toggle"
              className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/40 sm:px-5 ${open ? "" : "rounded-b-lg"}`}>
              <span className="flex items-center gap-2"><SlidersHorizontal size={15} strokeWidth={1.75} className="text-muted-foreground" />{t("assumptions")}</span>
              <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className="space-y-4 px-4 pb-4 pt-1 sm:px-5 sm:pb-5" data-testid="assumptions-panel">
                <div>
                  <div className="mb-1.5 text-[13px] font-medium text-foreground/80">{t("forecast_scope")}</div>
                  <div className="grid grid-cols-3 gap-0.5 rounded-md border border-input bg-background p-0.5" role="radiogroup" aria-label={t("forecast_scope")}>
                    {["current", "quran", "range"].map((s) => (
                      <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => pickScope(s)} data-testid={`scope-${s}`}
                        className={`rounded-[4px] px-2 py-1.5 text-xs font-semibold transition-colors ${scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
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
                    <span className="mb-1.5 block text-[13px] font-medium text-foreground/80">{t("baseline_pace")}</span>
                    <select className={inputCls} value={pace} onChange={(e) => setPace(e.target.value)} data-testid="pace-select">
                      {PACES.map((k) => <option key={k} value={k}>{paceLabel(k)}</option>)}
                    </select>
                    <span className={`mt-1 block text-[11px] ${a.cold_start ? "font-semibold text-warning" : "text-muted-foreground"}`}>
                      {a.cold_start ? t("baseline_pace_sparse_hint") : t("baseline_pace_hint")}
                    </span>
                  </label>
                )}

                {!isDefault && (
                  <div className={`rounded-md border border-border bg-background p-3 transition-opacity ${busy ? "opacity-60" : ""}`} data-testid="scenario-result" aria-live="polite">
                    <div className="text-[11px] font-semibold text-muted-foreground">{from === to ? t("scenario_title_one", { juz: from }) : t("scenario_title", { from, to })}</div>
                    {!scenario ? (
                      <div className="mt-1 text-sm text-muted-foreground">{t("loading")}</div>
                    ) : scenario.remaining_pages <= 0 ? (
                      <div className="mt-1 text-sm font-semibold">{t("scenario_already_done")}</div>
                    ) : scenario.eta_days == null ? (
                      <div className="mt-1 text-sm text-muted-foreground">{t("scenario_no_pace")}</div>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-xl font-semibold tabular-nums" title={scenario.predicted_completion_date} data-testid="scenario-date">{longDate(scenario.predicted_completion_date, locale)}</span>
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
          </div>
        </>
      )}
    </Panel>
  );
}
