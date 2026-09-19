import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnPrimary, inputCls, PageTitle } from "../../components/ui-kit";

export default function Settings() {
  const { t } = useT();
  const [rows, setRows] = useState([]);
  const [evalRep, setEvalRep] = useState(null);
  const [evalBusy, setEvalBusy] = useState(false);
  useEffect(() => { api.get("/settings").then((r) => setRows(r.data)); }, []);
  const runEval = () => { setEvalBusy(true); api.get("/forecast-evaluation").then((r) => setEvalRep(r.data)).catch((e) => toast.error(errMsg(e))).finally(() => setEvalBusy(false)); };
  const save = async (e) => {
    e.preventDefault();
    try { const { data } = await api.put("/settings", { settings: Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value])) }); setRows(data); toast.success(t("saved")); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <div>
      <PageTitle title={t("settings_title")} subtitle={t("settings_note")} />
      <form onSubmit={save} className="glass max-w-xl rounded-2xl p-5 space-y-4" data-testid="settings-form">
        {rows.map((r, i) => <label key={r.setting_key} className="flex items-center justify-between gap-4 text-sm"><span><span className="font-mono font-semibold">{r.setting_key}</span><span className="block text-xs text-muted-foreground">{r.description}</span></span>
          <input data-testid={`setting-${r.setting_key}`} className={`${inputCls} !w-32 font-mono`} dir="ltr" type="number" step="any" value={r.setting_value} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, setting_value: e.target.value } : x)))} /></label>)}
        <div className="flex justify-end"><button data-testid="settings-save-button" className={btnPrimary}>{t("save")}</button></div>
      </form>

      <section className="mt-10 max-w-3xl" data-testid="forecast-evaluation-section">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-bold">{t("eval_title")}</h2><p className="text-xs text-muted-foreground">{t("eval_note")}</p></div>
          <button data-testid="run-evaluation-button" className={btnPrimary} onClick={runEval} disabled={evalBusy}>{evalBusy ? t("loading") : t("run_evaluation")}</button>
        </div>
        {evalRep && <div className="glass overflow-x-auto rounded-2xl animate-rise" data-testid="evaluation-report">
          <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
            {t("eval_rows", { students: evalRep.split.students_total, total: evalRep.split.rows_total, train: evalRep.split.rows_train, test: evalRep.split.rows_test })} · {t("eval_split")} · {evalRep.generated_at}
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground"><th className="px-4 py-2 text-start">{t("model")}</th><th className="px-4 py-2 text-start">{t("eval_within")}</th><th className="px-4 py-2 text-start">{t("eval_mae")}</th><th className="px-4 py-2 text-start">{t("eval_rmse")}</th><th className="px-4 py-2 text-start">{t("eval_bias")}</th><th className="px-4 py-2 text-start">NFR10</th></tr></thead>
            <tbody className="divide-y divide-border/60">{Object.entries(evalRep.results).map(([name, r]) => <tr key={name} data-testid={`eval-row-${name}`} className={name === evalRep.best_by_mae_days ? "bg-primary/5" : ""}><td className="px-4 py-2 font-mono text-xs">{name}{name === evalRep.best_by_mae_days && <span className="ms-2 text-[10px] text-gold">★</span>}</td><td className="px-4 py-2 font-mono">{r.within_2_weeks_pct}%</td><td className="px-4 py-2 font-mono">{r.mae_days}</td><td className="px-4 py-2 font-mono">{r.rmse_days}</td><td className="px-4 py-2 font-mono">{r.bias_days}</td><td className="px-4 py-2"><span className={`chip !min-h-0 text-[11px] ${r.meets_nfr10_target ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}`}>{r.meets_nfr10_target ? t("eval_met") : t("eval_not_met")}</span></td></tr>)}</tbody>
          </table>
          <div className="space-y-1 px-4 py-2 text-[11px] text-muted-foreground">
            <div data-testid="eval-discussion">{evalRep.discussion}</div>
            <div>{t("eval_alternative")}: <span className="font-mono">{evalRep.alternative_model?.name}</span> — {evalRep.alternative_model?.why}</div>
            <div>{evalRep.note}</div>
          </div>
        </div>}
      </section>
    </div>
  );
}
