// UC10 alternative flow 5a: offline queue — sessions are stored locally and synced on reconnect.
const KEY = "halaqtna_session_queue";

export const readQueue = () => JSON.parse(localStorage.getItem(KEY) || "[]");
export const queueSession = (body) => localStorage.setItem(KEY, JSON.stringify([...readQueue(), body]));

export async function flushQueue(api) {
  const q = readQueue();
  if (!q.length) return 0;
  const remaining = [];
  let sent = 0;
  for (const body of q) {
    try { await api.post("/sessions", body); sent++; }
    catch (e) { if (!e.response) remaining.push(body); else sent++; /* rejected by server (e.g. duplicate) → drop */ }
  }
  localStorage.setItem(KEY, JSON.stringify(remaining));
  return sent;
}
