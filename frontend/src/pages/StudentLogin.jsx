import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { errMsg } from "../lib/api";
import { LangThemeToggles } from "../components/Shell";
import { btnPrimary } from "../components/ui-kit";

const DEMO_CODES = ["STU1AB2C", "STU3EF4G", "STU7NP8Q"];

export default function StudentLogin() {
  const { t } = useT();
  const { loginStudent } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e, c = code) => {
    e?.preventDefault();
    setBusy(true);
    try { await loginStudent(c); nav("/student"); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10">
      <div className="flex items-center justify-between"><div className="font-bold">{t("app_name")}</div><LangThemeToggles /></div>
      <div className="my-auto w-full max-w-md self-center text-center animate-rise">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-secondary text-secondary-foreground font-quran text-3xl shadow-lg">ح</div>
        <div className="eyebrow mt-6">{t("student_login")}</div>
        <h1 className="mt-1 text-3xl font-extrabold">{t("access_code")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("access_code_hint")}</p>
        <form onSubmit={submit} className="mt-6 space-y-4" data-testid="student-login-form">
          <input data-testid="student-code-input" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} maxLength={8} placeholder="········" autoComplete="off"
            className="code-display w-full rounded-2xl border-2 border-input bg-card px-4 py-4 text-center outline-none focus:border-primary" />
          <button data-testid="student-login-submit-button" className={`${btnPrimary} w-full`} disabled={busy || code.length < 8}>{busy ? t("signing_in") : t("enter")}</button>
        </form>
        <div className="mt-8"><div className="eyebrow mb-2">{t("demo_codes")}</div>
          <div className="flex flex-wrap justify-center gap-2">{DEMO_CODES.map((c) => <button key={c} data-testid={`demo-code-${c}`} onClick={(e) => { setCode(c); submit(e, c); }} className="chip glass font-mono tracking-widest hover:bg-primary/10" dir="ltr">{c}</button>)}</div>
        </div>
        <Link to="/login" data-testid="go-staff-login-link" className="mt-6 block text-sm font-semibold text-secondary underline-offset-4 hover:underline">{t("i_am_staff")}</Link>
      </div>
    </div>
  );
}
