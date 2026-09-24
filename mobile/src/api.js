import axios from "axios";
import Constants from "expo-constants";

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

export const errMsg = (e) => e?.response?.data?.message || (e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join(" ")) || e?.message || "Error";
