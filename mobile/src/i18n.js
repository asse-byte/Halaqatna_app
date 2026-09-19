import React, { createContext, useContext, useState } from "react";
import { I18nManager } from "react-native";
import ar from "../../frontend/src/locales/ar.json";
import en from "../../frontend/src/locales/en.json";

// Shares the exact same key set as the web client, so the NFR6 parity check covers mobile too.
const D = { ar, en };
const Ctx = createContext(null);
export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState("ar");
  const t = (k, vars) => Object.entries(vars || {}).reduce((s, [a, b]) => s.replace(`{${a}}`, b), D[locale][k] ?? D.en[k] ?? k);
  const toggle = () => { const n = locale === "ar" ? "en" : "ar"; I18nManager.forceRTL(n === "ar"); setLocale(n); };
  return <Ctx.Provider value={{ locale, t, toggle, isRtl: locale === "ar" }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
