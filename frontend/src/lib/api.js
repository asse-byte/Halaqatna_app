import axios from "axios";

// Same origin by default: nginx serves the SPA and proxies /api and /p to Laravel, and the
// Vite dev server proxies the same two paths. Set VITE_API_URL only to point at another host.
const BASE = import.meta.env.VITE_API_URL || "";

export const TOKEN_KEY = "halaqtna_token";
/** Which sign-in screen to return to when the token expires: staff and students use different ones. */
export const ACTOR_TYPE_KEY = "halaqtna_actor_type";

export const api = axios.create({ baseURL: `${BASE}/api`, headers: { Accept: "application/json" } });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // An expired or revoked session: back to the sign-in screen this person actually uses.
    // A failed sign-in is also a 401, and must stay on the form to show its message; the
    // start-up check (/auth/me) only needs the token gone — AuthProvider routes from there.
    const url = String(err.config?.url || "");
    const isSignIn = url === "/auth/login" || url === "/auth/student-login";
    if (err.response?.status === 401 && !isSignIn && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      if (url !== "/auth/me") {
        window.location.assign(localStorage.getItem(ACTOR_TYPE_KEY) === "student" ? "/student-login" : "/login");
      }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e, fallback = "Something went wrong") => {
  const d = e?.response?.data;
  if (!d) return e?.message || fallback;
  if (d.errors) return Object.values(d.errors).flat().join(" ");
  return d.message || fallback;
};

/**
 * Downloads a PDF with the session's token and opens it in a new tab.
 *
 * The tab is opened BEFORE the download: a window opened after an `await` is no longer a
 * response to the click, and pop-up blockers (Safari's in particular) refuse it silently.
 */
export async function openPdf(path, locale) {
  const win = window.open("", "_blank");
  try {
    const { data } = await api.get(path, { params: { locale }, responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    if (win) win.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    // With responseType "blob" the error body is a Blob too; read it so errMsg can show it.
    if (e.response?.data instanceof Blob) {
      try { e.response.data = JSON.parse(await e.response.data.text()); } catch { /* not JSON */ }
    }
    throw e;
  }
}
