import axios from "axios";

// Same origin by default: nginx serves the SPA and proxies /api and /p to Laravel, and the
// Vite dev server proxies the same two paths. Set VITE_API_URL only to point at another host.
const BASE = import.meta.env.VITE_API_URL || "";

export const api = axios.create({ baseURL: `${BASE}/api`, headers: { Accept: "application/json" } });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("halaqtna_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("halaqtna_token")) {
      localStorage.removeItem("halaqtna_token");
      window.location.assign("/login");
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

export const pdfUrl = (path, locale) => `${BASE}/api${path}?locale=${locale}`;

export async function openPdf(path, locale) {
  const { data } = await api.get(path, { params: { locale }, responseType: "blob" });
  window.open(URL.createObjectURL(new Blob([data], { type: "application/pdf" })), "_blank");
}
