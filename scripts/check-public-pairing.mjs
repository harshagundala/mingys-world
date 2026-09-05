/** Exercise against TWO local hub processes using the same isolated QA world. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
const origin = "http://127.0.0.1:4101",
  other = "ws://127.0.0.1:4102/api/ws";
const sockets = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(body) {
  const r = await fetch(
    origin + "/api/session",
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  assert.equal(r.status, 200);
  return r.json();
}
async function connect(
  playerId,
  { endpoint = "ws://127.0.0.1:4101/api/ws", room = "", role = 0 } = {},
) {
  const ws = new WebSocket(endpoint);
  const peer = {
    ws,
    events: [],
    code: null,
    send: (m) => ws.send(JSON.stringify(m)),
  };
  sockets.push(peer);
  ws.on("message", (raw) => peer.events.push(JSON.parse(raw)));
  ws.on("close", (code) => (peer.code = code));
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });
  peer.wait = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      const event = peer.events.find(predicate);
      if (event) return event;
      await sleep(25);
    }
    throw new Error("Timed out waiting for socket event");
  };
  peer.send({ type: "join", room, role, playerId });
  return peer;
}
const welcome = (peer) => peer.wait((m) => m.type === "welcome");
try {
  const initial = await api();
  assert.equal(initial.authorized, true);
  assert.ok(initial.room);
  assert.equal("invite" in initial, false);
  const reset = await api({ action: "reset" });
  const active = reset.room;
  assert.equal((await api()).room, active);
  assert.equal(
    (await fetch(origin + "/api/photo?id=0&thumb=1")).status,
    200,
    "photos load without an invitation cookie",
  );
  const firstId = randomUUID(),
    secondId = randomUUID();
  const [a, b] = await Promise.all([
    connect(firstId),
    connect(secondId, { endpoint: other }),
  ]);
  const [wa, wb] = await Promise.all([welcome(a), welcome(b)]);
  assert.equal(wa.room, active);
  assert.equal(wb.room, active);
  assert.notEqual(wa.role, wb.role);
  console.log(
    "PASS cookie-free entry and simultaneous pairing across two server instances",
  );
  const c = await connect(randomUUID());
  assert.equal((await c.wait((m) => m.type === "error")).fatal, true);
  assert.equal(
    c.events.some((m) => m.type === "welcome"),
    false,
  );
  console.log("PASS a third device cannot displace the connected pair");
  a.send({ type: "pose", pose: { ...wa.pose, x: 1.1, z: 5 } });
  await sleep(100);
  a.send({ type: "action", action: { kind: "bell" } });
  await a.wait((m) => m.type === "state" && m.state.bells.includes(wa.role));
  const seen = b.events.length;
  const replacement = await connect(firstId, {
    endpoint: other,
    role: 1 - wa.role,
  });
  const wr = await welcome(replacement);
  assert.equal(wr.role, wa.role);
  assert.ok(wr.state.bells.includes(wa.role));
  assert.equal(wr.pose.z, 5);
  for (let i = 0; i < 100 && a.code === null; i++) await sleep(25);
  assert.equal(a.code, 4410);
  await sleep(150);
  assert.equal(
    b.events.slice(seen).some((m) => m.type === "left" && m.role === wa.role),
    false,
  );
  console.log(
    "PASS refresh/replacement preserves identity, position and progress without a ghost disconnect",
  );
  replacement.ws.close();
  await b.wait((m) => m.type === "left" && m.role === wa.role);
  const returning = await connect(firstId);
  const returned = await welcome(returning);
  assert.equal(returned.role, wa.role);
  assert.ok(returned.state.bells.includes(wa.role));
  assert.equal(returned.pose.z, 5);
  console.log(
    "PASS clean disconnect releases the slot immediately and later return restores its save",
  );
  const old = await api({ action: "reset" });
  assert.equal(old.previousRoom, active);
  assert.notEqual(old.room, active);
  await Promise.all([
    returning.wait((m) => m.type === "world-reset"),
    b.wait((m) => m.type === "world-reset"),
  ]);
  returning.ws.close();
  b.ws.close();
  const explicit = await connect(firstId, { room: active });
  const archived = await welcome(explicit);
  assert.ok(archived.state.bells.includes(wa.role));
  const [nextA, nextB] = await Promise.all([
    connect(randomUUID()),
    connect(randomUUID(), { endpoint: other }),
  ]);
  const [na, nb] = await Promise.all([welcome(nextA), welcome(nextB)]);
  assert.equal(na.room, old.room);
  assert.equal(nb.room, old.room);
  assert.deepEqual(na.state.bells, []);
  assert.notEqual(na.role, nb.role);
  const mark = explicit.events.length;
  await api({ action: "reset" });
  await nextA.wait((m) => m.type === "world-reset");
  await sleep(100);
  assert.equal(
    explicit.events.slice(mark).some((m) => m.type === "world-reset"),
    false,
  );
  console.log(
    "PASS shared reset reaches both devices, preserves the old save, and leaves explicit saved rooms alone",
  );
  console.log("Public pairing integration passed");
} finally {
  for (const p of sockets) p.ws.close();
  await sleep(100);
}
