import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useT } from "../lib/i18n";
import { InstallApp } from "../components/InstallApp";
import { useAuth } from "../lib/auth";
import { errMsg } from "../lib/api";
import { LangThemeToggles } from "../components/Shell";
import { btnPrimary } from "../components/ui-kit";
import { LoginPanel } from "./StaffLogin";

/** Short codes in the shape the system now issues: three letters, then three digits. */
const DEMO_CODES = import.meta.env.DEV ? ["NUR482", "FLH927", "SKN519"] : [];
const CODE_LENGTH = 6;

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
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <LoginPanel className="hidden lg:block" />
      <LoginPanel compact className="lg:hidden" />
      <section className="flex flex-1 flex-col px-5 py-5 sm:px-10 lg:min-h-screen">
        <div className="flex justify-end"><LangThemeToggles /></div>

        <div className="my-auto w-full max-w-[400px] self-center py-8 lg:py-10">
          <div className="eyebrow">{t("student_login")}</div>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-tight">{t("access_code")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("access_code_hint")}</p>
          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="student-login-form">
            {/* Accepts up to 12 characters so the eight-character codes issued before the
                change still sign in; new codes are six. */}
            <input data-testid="student-code-input" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} maxLength={12} placeholder="ABC123" autoComplete="off" aria-label={t("access_code")}
              className="code-display w-full rounded-md border border-input bg-card px-4 py-4 text-center outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/30 focus:border-primary focus:ring-[3px] focus:ring-primary/15" />
            <button data-testid="student-login-submit-button" className={`${btnPrimary} w-full !py-3`} disabled={busy || code.length < CODE_LENGTH}>{busy ? t("signing_in") : t("enter")}</button>
          </form>

          {DEMO_CODES.length > 0 && (
            <div className="mt-10">
              <div className="eyebrow mb-2">{t("demo_codes")}</div>
              <div className="panel grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg rtl:divide-x-reverse">
                {DEMO_CODES.map((c) => (
                  <button key={c} data-testid={`demo-code-${c}`} onClick={(e) => { setCode(c); submit(e, c); }} dir="ltr"
                    className="px-2 py-3 font-mono text-sm tracking-widest transition-colors hover:bg-muted/60">{c}</button>
                ))}
              </div>
            </div>
          )}

          <Link to="/login" data-testid="go-staff-login-link"
            className="group mt-6 flex items-center justify-between gap-3 border-t border-border pt-5 text-sm font-semibold text-primary">
            <span className="underline-offset-4 group-hover:underline">{t("i_am_staff")}</span>
            <ArrowLeft size={16} className="shrink-0 ltr:-scale-x-100" />
          </Link>
          <div className="mt-5"><InstallApp /></div>
        </div>
      </section>
    </div>
  );
}
