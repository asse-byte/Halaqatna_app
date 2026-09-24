// UC10 alternative flow 5a: offline queue — sessions are stored locally and synced on reconnect.
//
// This module has no imports on purpose: scripts/check_offline_queue.mjs loads it as-is in
// Node, without a bundler.
const KEY = "halaqtna_session_queue";

/**
 * Whether the server has answered for good. A 409 (already recorded) or a 422 (invalid)
 * will never succeed, so retrying it forever would only block the queue. No answer at all,
 * an expired sign-in (401), a timeout (408), a throttle (429) or a server fault (5xx) says
 * nothing about the session itself — it stays queued for the next attempt.
 */
const isFinal = (status) => status >= 400 && status < 500 && ![401, 408, 429].includes(status);

/** A session's identity inside the queue. Sessions queued by older builds have no client_uuid. */
const idOf = (body) => body.client_uuid ?? JSON.stringify(body);

export function readQueue() {
  try {
    const q = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

const writeQueue = (q) => localStorage.setItem(KEY, JSON.stringify(q));

export const queueSession = (body) => writeQueue([...readQueue(), body]);

/** An id for a session that may be sent twice. crypto.randomUUID exists only on HTTPS and localhost. */
export const newClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

async function sendQueued(api) {
  const done = new Set();
  let sent = 0;
  for (const body of readQueue()) {
    try {
      await api.post("/sessions", body);
      done.add(idOf(body));
      sent++;
    } catch (e) {
      const status = e?.response?.status;
      if (status && isFinal(status)) done.add(idOf(body));
      else if (!status) break;   // still offline: the rest would fail the same way
    }
  }
  // Re-read before writing: a session queued while this flush was running must survive it.
  writeQueue(readQueue().filter((b) => !done.has(idOf(b))));
  return sent;
}

let inFlight = null;

/**
 * Sends everything queued. Returns how many sessions the server accepted.
 *
 * One flush at a time: the browser's "online" event and a page's own sync can fire
 * together, and two flushes running side by side would post every queued session twice.
 */
export function flushQueue(api) {
  inFlight ??= sendQueued(api).finally(() => { inFlight = null; });
  return inFlight;
}
