import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnPrimary, inputCls, PageTitle } from "../../components/ui-kit";

/**
 * FR19 — the system settings.
 *
 * The first build listed the raw keys — d_max, alpha, xp_per_page — with no explanation, so
 * the page was unreadable to the one person allowed to open it. Each setting now appears
 * under the question it answers, with a sentence on what raising or lowering it does. The
 * stored key is shown underneath in small type, because it is what the calculation and the
 * report call the value and hiding it would make the two impossible to line up.
 */
export default function Settings() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [evalRep, setEvalRep] = useState(null);
  const [evalBusy, setEvalBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings").then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e))); }, []);

  const runEval = () => {
    setEvalBusy(true);
    api.get("/forecast-evaluation").then((r) => setEvalRep(r.data)).catch((e) => toast.error(errMsg(e))).finally(() => setEvalBusy(false));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/settings", { settings: Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value])) });
      setRows(data);
      toast.success(t("saved"));
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  /** Falls back to the stored description for any key added after this screen was written. */
  const label = (r) => (t(`setting_${r.setting_key}`) === `setting_${r.setting_key}` ? r.setting_key : t(`setting_${r.setting_key}`));
  const hint = (r) => (t(`setting_${r.setting_key}_hint`) === `setting_${r.setting_key}_hint` ? r.description : t(`setting_${r.setting_key}_hint`));

  return (
    <div>
      <PageTitle title={t("settings_title")} subtitle={t("settings_note")} />

      <form onSubmit={save} className="max-w-3xl space-y-3" data-testid="settings-form">
        {rows.map((r, i) => (
          <div key={r.setting_key} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{label(r)}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint(r)}</p>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground/70" dir="ltr">{r.setting_key}</div>
            </div>
            <input data-testid={`setting-${r.setting_key}`} className={`${inputCls} !w-28 text-center font-mono`} dir="ltr" type="number" step="any"
              value={r.setting_value} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, setting_value: e.target.value } : x)))} />
          </div>
        ))}
        <div className="flex justify-end">
          <button data-testid="settings-save-button" className={btnPrimary} disabled={busy}><Save size={15} />{t("save")}</button>
        </div>
      </form>

      <section className="mt-10 max-w-3xl" data-testid="forecast-evaluation-section">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{t("eval_title")}</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{t("eval_note")}</p>
          </div>
          <button data-testid="run-evaluation-button" className={btnPrimary} onClick={runEval} disabled={evalBusy}>{evalBusy ? t("loading") : t("run_evaluation")}</button>
        </div>

        {evalRep && (
          <div className="glass overflow-x-auto rounded-2xl animate-rise" data-testid="evaluation-report">
            <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
              {t("eval_rows", { students: evalRep.split.students_total, total: evalRep.split.rows_total, train: evalRep.split.rows_train, test: evalRep.split.rows_test })}
              {" · "}{t("eval_split")}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-start">{t("model")}</th>
                  <th className="px-4 py-2 text-start">{t("eval_within")}</th>
                  <th className="px-4 py-2 text-start">{t("eval_mae")}</th>
                  <th className="px-4 py-2 text-start">{t("eval_rmse")}</th>
                  <th className="px-4 py-2 text-start">{t("eval_bias")}</th>
                  <th className="px-4 py-2 text-start">{t("eval_within")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {Object.entries(evalRep.results).map(([name, r]) => (
                  <tr key={name} data-testid={`eval-row-${name}`} className={name === evalRep.best_by_mae_days ? "bg-primary/5" : ""}>
                    <td className="px-4 py-2 font-mono text-xs">{name}{name === evalRep.best_by_mae_days && <span className="ms-2 text-[10px] text-gold">★</span>}</td>
                    <td className="px-4 py-2 font-mono">{r.within_2_weeks_pct}%</td>
                    <td className="px-4 py-2 font-mono">{r.mae_days}</td>
                    <td className="px-4 py-2 font-mono">{r.rmse_days}</td>
                    <td className="px-4 py-2 font-mono">{r.bias_days}</td>
                    <td className="px-4 py-2">
                      <span className={`chip !min-h-0 text-[11px] ${r.meets_nfr10_target ? "border-emerald-300 text-emerald-700 dark:text-emerald-400" : "border-red-300 text-red-700 dark:text-red-400"}`}>
                        {r.meets_nfr10_target ? t("eval_met") : t("eval_not_met")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 px-4 py-2 text-[11px] text-muted-foreground">
              <div data-testid="eval-discussion">{evalRep.discussion}</div>
              <div>{t("eval_alternative")}: <span className="font-mono">{evalRep.alternative_model?.name}</span> — {evalRep.alternative_model?.why}</div>
              <div>{evalRep.note}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
