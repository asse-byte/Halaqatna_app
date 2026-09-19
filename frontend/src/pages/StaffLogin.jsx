import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT } from "../lib/i18n";
import { homeFor, useAuth } from "../lib/auth";
import { errMsg } from "../lib/api";
import { LangThemeToggles } from "../components/Shell";
import { btnPrimary, Field, inputCls } from "../components/ui-kit";

/**
 * One-click sign-in for the seeded demo fixtures (see README "Demo data").
 *
 * Development only: `import.meta.env.DEV` is statically false in a production build, so the
 * block below — and the fixture passwords in it — are dropped by tree-shaking and never reach
 * `dist/`. Shipping one-click logins to a deployment a real user can reach would hand out a
 * Circle Administrator session to anyone who loads the page.
 *
 * The System Administrator is seeded from SYS_ADMIN_EMAIL / SYS_ADMIN_PASSWORD in `api/.env`,
 * so it is only offered here when those values are mirrored into the web env.
 */
const DEMO = import.meta.env.DEV
  ? [
      ["SYS_ADMIN", import.meta.env.VITE_DEMO_SYS_ADMIN_EMAIL, import.meta.env.VITE_DEMO_SYS_ADMIN_PASSWORD],
      ["CIRCLE_ADMIN", "admin.nafi@halaqtna.sa", "Pass#2026"],
      ["TEACHER", "teacher.ahmad@halaqtna.sa", "Pass#2026"],
    ].filter(([, em, pw]) => em && pw)
  : [];

export default function StaffLogin() {
  const { t } = useT();
  const { loginStaff } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e, em = email, pw = password) => {
    e?.preventDefault();
    setBusy(true);
    try { nav(homeFor(await loginStaff(em, pw))); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:block">
        <img src="https://images.unsplash.com/photo-1554110838-816383ce7956?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="font-quran text-3xl">﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ ﴾</div>
          <div><div className="eyebrow !text-primary-foreground/60">CPIT-499 · KAU</div><h1 className="mt-2 text-5xl font-extrabold">{t("app_name")}</h1><p className="mt-3 max-w-md text-primary-foreground/80">{t("tagline")}</p></div>
        </div>
      </section>
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10">
        <div className="flex justify-end"><LangThemeToggles /></div>
        <div className="my-auto w-full max-w-md self-center animate-rise">
          <div className="eyebrow">{t("staff_login")}</div>
          <h2 className="mt-1 text-3xl font-extrabold">{t("sign_in")}</h2>
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="staff-login-form">
            <Field label={t("email")}><input data-testid="login-email-input" className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" /></Field>
            <Field label={t("password")}><input data-testid="login-password-input" className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" /></Field>
            <button data-testid="login-submit-button" className={`${btnPrimary} w-full`} disabled={busy}>{busy ? t("signing_in") : t("sign_in")}</button>
          </form>
          {DEMO.length > 0 && (
            <div className="mt-8"><div className="eyebrow mb-2">{t("demo_accounts")}</div>
              <div className="grid gap-2">{DEMO.map(([role, em, pw]) => <button key={role} data-testid={`demo-login-${role}`} onClick={(e) => { setEmail(em); setPassword(pw); submit(e, em, pw); }} className="glass flex items-center justify-between rounded-xl px-4 py-2.5 text-sm hover:bg-primary/5"><span className="font-semibold">{t(`role_${role}`)}</span><span className="font-mono text-xs text-muted-foreground" dir="ltr">{em}</span></button>)}</div>
            </div>
          )}
          <Link to="/student-login" data-testid="go-student-login-link" className="mt-6 block text-center text-sm font-semibold text-secondary underline-offset-4 hover:underline">{t("i_am_student")}</Link>
        </div>
      </section>
    </div>
  );
}
