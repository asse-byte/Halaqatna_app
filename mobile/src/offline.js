// UC10 alternative flow 5a — queue sessions offline, sync on reconnect.
// The same rules as the web client's frontend/src/lib/offline.js, over AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { api, hasToken } from "./api";

const KEY = "halaqtna_session_queue";

/** 409/422 will never succeed — drop. No answer, 401, 408, 429 or 5xx — keep for the next attempt. */
const isFinal = (status) => status >= 400 && status < 500 && ![401, 408, 429].includes(status);
const idOf = (body) => body.client_uuid ?? JSON.stringify(body);

export async function readQueue() {
  try {
    const q = JSON.parse((await AsyncStorage.getItem(KEY)) || "[]");
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

const writeQueue = (q) => AsyncStorage.setItem(KEY, JSON.stringify(q));

export const queueSession = async (body) => writeQueue([...(await readQueue()), body]);

export const newClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

async function sendQueued() {
  const done = new Set();
  let sent = 0;
  for (const body of await readQueue()) {
    try {
      await api.post("/sessions", body);
      done.add(idOf(body));
      sent++;
    } catch (e) {
      const status = e?.response?.status;
      if (status && isFinal(status)) done.add(idOf(body));
      else if (!status) break;   // still offline
    }
  }
  // Re-read before writing: a session queued while this flush was running must survive it.
  await writeQueue((await readQueue()).filter((b) => !done.has(idOf(b))));
  return sent;
}

let inFlight = null;

/**
 * Sends everything queued; returns how many the server accepted. One flush at a time, and
 * never before sign-in: NetInfo reports "connected" the moment the app starts, before the
 * saved token has been read back, and a flush then would have met a 401 for every session.
 */
export function flushQueue() {
  if (!hasToken()) return Promise.resolve(0);
  inFlight ??= sendQueued().finally(() => { inFlight = null; });
  return inFlight;
}

export const listenForReconnect = (cb) => NetInfo.addEventListener((s) => { if (s.isConnected) cb(); });
