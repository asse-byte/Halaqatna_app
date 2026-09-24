import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import { useT } from "../lib/i18n";
import { btnGhost } from "./ui-kit";

/**
 * The expected completion date (FR10), shared by the student's page and the staff view.
 * When the forecasting service is down the last stored forecast is shown with a notice
 * that it may be out of date (UC13), rather than no forecast at all.
 */
export function ForecastCard({ pred, onRefresh }) {
  const { t } = useT();
  const p = pred?.prediction;
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
    </div>
  );
}
