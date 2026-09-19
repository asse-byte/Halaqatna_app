import axios from "axios";
import Constants from "expo-constants";

// Base URL comes from app.json → expo.extra.apiUrl (nginx public HTTPS endpoint); never hardcode.
export const api = axios.create({ baseURL: `${Constants.expoConfig?.extra?.apiUrl}/api`, timeout: 15000 });
export const setToken = (t) => { api.defaults.headers.common.Authorization = t ? `Bearer ${t}` : undefined; };
export const errMsg = (e) => e?.response?.data?.message || (e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join(" ")) || e?.message || "Error";
