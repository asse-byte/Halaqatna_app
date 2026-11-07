import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useT } from "../lib/i18n";
import { InstallApp } from "../components/InstallApp";
import { homeFor, useAuth } from "../lib/auth";
import { errMsg } from "../lib/api";
import { LangThemeToggles } from "../components/Shell";
import { Seal, StarLattice } from "../components/Brand";
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

const VERSE = "﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ ﴾";

/**
 * The lapis panel both sign-in pages share: the verse, the name, and the star lattice.
 * `compact` is the band a phone shows above the form in place of the side panel.
 */
export function LoginPanel({ className = "", compact = false }) {
  const { t } = useT();
  const ground = `relative overflow-hidden bg-primary text-primary-foreground dark:bg-[hsl(214_45%_16%)] dark:text-foreground ${className}`;
  if (compact) {
    return (
      <section className={ground}>
        <StarLattice className="absolute inset-0 h-full w-full text-gold opacity-[0.22]" size={64} />
        <div className="relative px-5 pb-6 pt-5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <Seal className="h-8 w-8" />
            <span className="font-display text-xl font-semibold">{t("app_name")}</span>
          </div>
          <blockquote className="mt-5 font-quran text-[24px] leading-[1.8]" lang="ar" dir="rtl">{VERSE}</blockquote>
          <div className="text-[11px] opacity-70">{t("verse_ref")}</div>
        </div>
      </section>
    );
  }
  return (
    <section className={ground}>
      <StarLattice className="absolute inset-0 h-full w-full text-gold opacity-[0.22]" />
      <div className="relative flex h-full flex-col justify-between gap-10 p-8 lg:p-12">
        <div className="flex items-center gap-3">
          <Seal className="h-10 w-10" />
          <div>
            <div className="font-display text-2xl font-semibold leading-tight">{t("app_name")}</div>
            <div className="text-xs opacity-70" dir="ltr">CPIT-499 · King Abdulaziz University</div>
          </div>
        </div>
        <figure>
          <blockquote className="font-quran text-[28px] leading-[1.9] lg:text-[40px]" lang="ar" dir="rtl">{VERSE}</blockquote>
          <figcaption className="mt-2 text-xs opacity-70">{t("verse_ref")}</figcaption>
          <p className="mt-8 max-w-sm border-t border-white/15 pt-4 text-sm leading-relaxed opacity-80">{t("tagline")}</p>
        </figure>
      </div>
    </section>
  );
}

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
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <LoginPanel className="hidden lg:block" />
      <LoginPanel compact className="lg:hidden" />
      <section className="flex flex-1 flex-col px-5 py-5 sm:px-10 lg:min-h-screen">
        <div className="flex justify-end"><LangThemeToggles /></div>

        <div className="my-auto w-full max-w-[400px] self-center py-8 lg:py-10">
          <div className="eyebrow">{t("staff_login")}</div>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-tight">{t("sign_in")}</h1>
          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="staff-login-form">
            <Field label={t("email")}><input data-testid="login-email-input" className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" /></Field>
            <Field label={t("password")}><input data-testid="login-password-input" className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" /></Field>
            <button data-testid="login-submit-button" className={`${btnPrimary} w-full !py-3`} disabled={busy}>{busy ? t("signing_in") : t("sign_in")}</button>
          </form>

          {DEMO.length > 0 && (
            <div className="mt-10">
              <div className="eyebrow mb-2">{t("demo_accounts")}</div>
              <div className="panel divide-y divide-border rounded-lg">
                {DEMO.map(([role, em, pw]) => (
                  <button key={role} data-testid={`demo-login-${role}`} onClick={(e) => { setEmail(em); setPassword(pw); submit(e, em, pw); }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/60">
                    <span className="font-semibold">{t(`role_${role}`)}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground" dir="ltr">{em}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Link to="/student-login" data-testid="go-student-login-link"
            className="group mt-6 flex items-center justify-between gap-3 border-t border-border pt-5 text-sm font-semibold text-primary">
            <span className="underline-offset-4 group-hover:underline">{t("i_am_student")}</span>
            <ArrowLeft size={16} className="shrink-0 ltr:-scale-x-100" />
          </Link>
          <div className="mt-5"><InstallApp /></div>
        </div>
      </section>
    </div>
  );
}
