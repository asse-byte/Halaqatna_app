import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Save } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { btnPrimary, Field, inputCls, PageTitle } from "../../components/ui-kit";

/**
 * Staff self-service.
 *
 * A teacher changes their own password and keeps their own contact details current without
 * having to ask the Circle Supervisor. The edits land on the same record the Supervisor
 * reads, so the roster and the circle report show the new details immediately — there is no
 * second copy of a teacher's profile anywhere in the system.
 *
 * Role, circle and account status are deliberately absent: those decide what this account
 * can reach, and they stay with the administrator who granted them.
 */
export default function MyAccount() {
  const { t, locale, setLocale } = useT();
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "", new_password_confirmation: "" });

  useEffect(() => { api.get("/me/profile").then((r) => setMe(r.data)).catch((e) => toast.error(errMsg(e))); }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch("/me/profile", {
        name: me.name, email: me.email, phone: me.phone || null, address: me.address || null, locale: me.locale,
      });
      setMe({ ...me, ...data });
      if (data.locale && data.locale !== locale) setLocale(data.locale);
      toast.success(t("profile_saved"));
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password !== pw.new_password_confirmation) return toast.error(t("passwords_do_not_match"));
    setBusy(true);
    try {
      await api.post("/me/password", pw);
      setPw({ current_password: "", new_password: "", new_password_confirmation: "" });
      toast.success(t("password_changed"));
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  if (!me) return <div className="text-muted-foreground">{t("loading")}</div>;
  return (
    <div className="mx-auto w-full max-w-2xl" data-testid="my-account-page">
      <PageTitle title={t("account_title")} subtitle={t("account_subtitle")} />

      <form onSubmit={saveProfile} className="glass space-y-4 rounded-2xl p-5" data-testid="profile-form">
        <h2 className="eyebrow">{t("my_details")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("full_name")}>
            <input data-testid="profile-name" className={inputCls} value={me.name || ""} onChange={(e) => setMe({ ...me, name: e.target.value })} required />
          </Field>
          <Field label={t("email")}>
            <input data-testid="profile-email" className={inputCls} type="email" dir="ltr" value={me.email || ""} onChange={(e) => setMe({ ...me, email: e.target.value })} required />
          </Field>
          <Field label={t("phone")}>
            <input data-testid="profile-phone" className={inputCls} type="tel" dir="ltr" placeholder="+9665…" value={me.phone || ""} onChange={(e) => setMe({ ...me, phone: e.target.value })} />
          </Field>
          <Field label={t("locale")}>
            <select data-testid="profile-locale" className={inputCls} value={me.locale || "ar"} onChange={(e) => setMe({ ...me, locale: e.target.value })}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("address")}>
              <input data-testid="profile-address" className={inputCls} value={me.address || ""} onChange={(e) => setMe({ ...me, address: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{t("circle")}: {me.circle_name || "—"} · {t(`role_${me.role}`)}</span>
          <button className={btnPrimary} data-testid="profile-save" disabled={busy}><Save size={15} />{t("save")}</button>
        </div>
      </form>

      <form onSubmit={savePassword} className="glass mt-5 space-y-4 rounded-2xl p-5" data-testid="password-form">
        <h2 className="eyebrow">{t("change_password")}</h2>
        <Field label={t("current_password")}>
          <input data-testid="current-password" className={inputCls} type="password" dir="ltr" autoComplete="current-password"
            value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("new_password")} hint={t("password_min_hint")}>
            <input data-testid="new-password" className={inputCls} type="password" dir="ltr" autoComplete="new-password" minLength={8}
              value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required />
          </Field>
          <Field label={t("confirm_password")}>
            <input data-testid="confirm-password" className={inputCls} type="password" dir="ltr" autoComplete="new-password" minLength={8}
              value={pw.new_password_confirmation} onChange={(e) => setPw({ ...pw, new_password_confirmation: e.target.value })} required />
          </Field>
        </div>
        <div className="flex justify-end">
          <button className={btnPrimary} data-testid="password-save" disabled={busy}><KeyRound size={15} />{t("change_password")}</button>
        </div>
      </form>
    </div>
  );
}
