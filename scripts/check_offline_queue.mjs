// §10 "Resilience" checklist: offline teacher device → session queued and synced (UC10, flow 5a).
//
// Exercises the real frontend/src/lib/offline.js. That file is an ES module inside a package
// without "type": "module", so it is loaded through a data: URL rather than by path — this
// keeps the check dependency-free instead of pulling a test runner into the project.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.join(here, "..", "frontend", "src", "lib", "offline.js"), "utf8");

// Minimal localStorage stand-in; the module reads the global.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { readQueue, queueSession, flushQueue } = await import(
  "data:text/javascript," + encodeURIComponent(source)
);

const session = (date) => ({ student_id: 1, session_date: date, attendance_status: "P", pages_memorized: 2 });

test("a session logged offline is queued locally", () => {
  store.clear();
  assert.deepEqual(readQueue(), []);
  queueSession(session("2026-03-01"));
  queueSession(session("2026-03-02"));
  assert.equal(readQueue().length, 2);
});

test("reconnecting syncs the queue and empties it", async () => {
  store.clear();
  queueSession(session("2026-03-01"));
  queueSession(session("2026-03-02"));

  const posted = [];
  const api = { post: async (url, body) => { posted.push([url, body]); return { data: {} }; } };

  const sent = await flushQueue(api);
  assert.equal(sent, 2);
  assert.equal(posted.length, 2);
  assert.equal(posted[0][0], "/sessions");
  assert.deepEqual(readQueue(), [], "queue must be empty after a successful sync");
});

test("a still-offline flush keeps the queue intact", async () => {
  store.clear();
  queueSession(session("2026-03-01"));

  // axios sets no `response` when the request never reached the server.
  const api = { post: async () => { throw new Error("Network Error"); } };

  assert.equal(await flushQueue(api), 0);
  assert.equal(readQueue().length, 1, "an unreachable server must not drop the session");
});

test("a session the server rejects is dropped, not retried forever", async () => {
  store.clear();
  queueSession(session("2026-03-01"));

  // 409: a session already exists for this student on this date (§2.7 UNIQUE).
  const api = { post: async () => { throw { response: { status: 409, data: { message: "duplicate" } } }; } };

  await flushQueue(api);
  assert.deepEqual(readQueue(), [], "a server-rejected session must not be retried forever");
});

test("flushing an empty queue is a no-op", async () => {
  store.clear();
  let called = false;
  assert.equal(await flushQueue({ post: async () => { called = true; } }), 0);
  assert.equal(called, false);
});
