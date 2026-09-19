import { createContext, useContext, useEffect, useMemo, useState } from "react";
import ar from "../locales/ar.json";
import en from "../locales/en.json";

const DICTS = { ar, en };
const LocaleCtx = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState(() => localStorage.getItem("halaqtna_locale") || "ar");
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    localStorage.setItem("halaqtna_locale", locale);
  }, [locale]);
  const value = useMemo(() => {
    const t = (key, vars) => {
      let s = DICTS[locale][key] ?? DICTS.en[key] ?? key;
      if (vars) Object.entries(vars).forEach(([k, v]) => (s = s.replace(`{${k}}`, v)));
      return s;
    };
    return { locale, setLocale, t, isRtl: locale === "ar", toggle: () => setLocale(locale === "ar" ? "en" : "ar") };
  }, [locale]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export const useT = () => useContext(LocaleCtx);
