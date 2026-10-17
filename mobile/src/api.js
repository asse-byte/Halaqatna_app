import axios from "axios";
import Constants from "expo-constants";
import { tr } from "./i18n";

// Base URL comes from app.json → expo.extra.apiUrl (nginx public HTTPS endpoint); never hardcode.
export const api = axios.create({ baseURL: `${Constants.expoConfig?.extra?.apiUrl}/api`, timeout: 15000 });

export const setToken = (t) => {
  if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
  else delete api.defaults.headers.common.Authorization;
};
export const hasToken = () => Boolean(api.defaults.headers.common.Authorization);

/**
 * What to do when the server says the session is over (expired token, a password changed
 * elsewhere, a suspended account). App.js points this at its sign-out; until then a 401 was
 * shown as an error on every screen and the teacher stayed "signed in" forever.
 */
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && err.config?.url !== "/auth/login" && hasToken()) onUnauthorized();
    return Promise.reject(err);
  }
);

/**
 * The message to show for a failed request. A 4xx carries a message the API wrote for the
 * user; a 500's text is internal detail and a request with no response only has axios's
 * "Network Error" — both get a localized message instead.
 */
export const errMsg = (e) => {
  if (!e?.response) return tr(e?.request ? "error_network" : "error");
  if (e.response.status === 500) return tr("error_server");
  const d = e.response.data;
  return d?.message || (d?.errors && Object.values(d.errors).flat().join(" ")) || tr("error");
};
