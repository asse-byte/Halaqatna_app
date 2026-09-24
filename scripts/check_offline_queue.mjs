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

const session = (date) => ({ student_id: 1, session_date: date, attendance_status: "P", pages_memorized: 2, client_uuid: `uuid-${date}` });
const rejectWith = (status) => ({ post: async () => { throw { response: { status, data: {} } }; } });

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

test("an expired sign-in or a server fault keeps the session for the next attempt", async () => {
  // Dropping on any response was losing sessions: a teacher whose token expired while
  // offline came back online, got a 401 for every queued session, and all of them vanished.
  for (const status of [401, 408, 429, 500, 503]) {
    store.clear();
    queueSession(session("2026-03-01"));
    assert.equal(await flushQueue(rejectWith(status)), 0);
    assert.equal(readQueue().length, 1, `a ${status} must not drop the session`);
  }
});

test("a session queued while a flush is running is not lost", async () => {
  store.clear();
  queueSession(session("2026-03-01"));
  const api = { post: async () => { queueSession(session("2026-03-09")); return { data: {} }; } };

  assert.equal(await flushQueue(api), 1);
  assert.deepEqual(readQueue().map((b) => b.session_date), ["2026-03-09"]);
});

test("two flushes at once post each session only once", async () => {
  store.clear();
  queueSession(session("2026-03-01"));
  queueSession(session("2026-03-02"));
  const posted = [];
  const api = { post: async (url, body) => { posted.push(body.session_date); await new Promise((r) => setTimeout(r, 5)); return { data: {} }; } };

  const [a, b] = await Promise.all([flushQueue(api), flushQueue(api)]);
  assert.equal(a, 2);
  assert.equal(b, 2, "the second caller shares the first flush");
  assert.deepEqual(posted, ["2026-03-01", "2026-03-02"]);
  assert.deepEqual(readQueue(), []);
});

test("a corrupted queue reads as empty instead of breaking the page", () => {
  store.clear();
  store.set("halaqtna_session_queue", "{not json");
  assert.deepEqual(readQueue(), []);
});

test("flushing an empty queue is a no-op", async () => {
  store.clear();
  let called = false;
  assert.equal(await flushQueue({ post: async () => { called = true; } }), 0);
  assert.equal(called, false);
});
