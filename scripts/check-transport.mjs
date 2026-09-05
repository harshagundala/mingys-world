import WebSocket from "ws";
import assert from "node:assert/strict";
import fs from "node:fs";
const origins = process.argv.slice(2);
if (!origins.length)
  origins.push("http://127.0.0.1:4101", "http://127.0.0.1:4102");
if (origins.length === 1) origins.push(origins[0]);
const room = "qa-" + crypto.randomUUID(),
  ids = [crypto.randomUUID(), crypto.randomUUID()];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function auth(origin) {
  const r = await fetch(origin + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invite: process.env.WORLD_SECRET }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
class Peer {
  constructor(origin, cookie, role, id = ids[role]) {
    this.origin = origin;
    this.cookie = cookie;
    this.role = role;
    this.id = id;
    this.state = null;
    this.messages = [];
    this.instanceIds = new Set();
  }
  async open() {
    this.ws = new WebSocket(this.origin.replace(/^http/, "ws") + "/api/ws", {
      headers: { Cookie: this.cookie },
    });
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      this.messages.push(m);
      if (m.state && (!this.state || m.state.version >= this.state.version))
        this.state = m.state;
      if (m.instance) this.instanceIds.add(m.instance);
    });
    await new Promise((r, j) => {
      this.ws.once("open", r);
      this.ws.once("error", j);
    });
    this.send({ type: "join", room, role: this.role, playerId: this.id });
    return this;
  }
  send(d) {
    this.ws.send(JSON.stringify(d));
  }
  async pose(x, z) {
    this.send({ type: "pose", pose: { x, y: 0, z, rot: 0, moving: false } });
    await sleep(80);
  }
  action(a) {
    this.send({ type: "action", action: a });
  }
  async until(fn) {
    for (let i = 0; i < 120; i++) {
      if (fn()) return;
      await sleep(100);
    }
    throw new Error(
      "Transport assertion timed out: " +
        JSON.stringify(this.messages.slice(-2)),
    );
  }
  close() {
    this.ws.close();
  }
}
const cookies = await Promise.all(origins.map(auth));
const a = await new Peer(origins[0], cookies[0], 0).open(),
  b = await new Peer(origins[1], cookies[1], 1).open();
let again;
try {
  await Promise.all([
    a.until(() => a.messages.some((m) => m.type === "welcome")),
    b.until(() => b.messages.some((m) => m.type === "welcome")),
  ]);
  await a.pose(1.1, 5);
  a.action({ kind: "bell" });
  await a.until(() => a.state.bells.includes(0));
  a.action({ kind: "bell" });
  await sleep(350);
  assert.equal(a.state.chapter, 0);
  await b.pose(1.1, 5);
  b.action({ kind: "bell" });
  await Promise.all([
    a.until(() => a.state.chapter === 1),
    b.until(() => b.state.chapter === 1),
  ]);
  console.log("Two separate arrivals and shared chapter: passed");
  await Promise.all([a.pose(-9, -7), b.pose(8, 3)]);
  a.action({ kind: "read", id: "clock-a" });
  b.action({ kind: "read", id: "clock-b" });
  await Promise.all([
    a.until(() => a.state.found.length === 2),
    b.until(() => b.state.found.length === 2),
  ]);
  assert.deepEqual([...a.state.found].sort(), ["clock-a", "clock-b"]);
  assert.deepEqual(a.state, b.state);
  console.log("Concurrent evidence updates, no lost writes: passed");
  a.action({
    kind: "solve",
    id: "sky",
    answer: ["moon", "comet", "sun", "paw", "key"],
  });
  await sleep(600);
  assert.equal(a.state.chapter, 1);
  console.log("Chapter skip rejected: passed");
  const duplicate = await new Peer(
    origins[0],
    cookies[0],
    0,
    crypto.randomUUID(),
  ).open();
  await duplicate.until(() =>
    duplicate.messages.some((m) => m.type === "error" && m.fatal),
  );
  duplicate.close();
  console.log("Third client cannot take an occupied puppy: passed");
  const before = structuredClone(a.state);
  a.close();
  await sleep(350);
  again = await new Peer(origins[0], cookies[0], 0).open();
  await again.until(() => again.messages.some((m) => m.type === "welcome"));
  assert.equal(again.state.chapter, before.chapter);
  assert.deepEqual([...again.state.found].sort(), [...before.found].sort());
  console.log("Reconnect restores durable progress: passed");
  const instanceIds = new Set([...a.instanceIds, ...b.instanceIds]);
  console.log("Observed server instances:", instanceIds.size);
  if (origins[0] !== origins[1]) assert.ok(instanceIds.size >= 2);
  const unauthorized = await fetch(origins[0] + "/api/photo?id=0");
  assert.equal(unauthorized.status, 401);
  const invalid = await fetch(origins[0] + "/api/photo?id=../../.env.local", {
    headers: { Cookie: cookies[0] },
  });
  assert.equal(invalid.status, 404);
  console.log("Private photo access and path validation: passed");
  let verified = 0;
  for (let offset = 0; offset < 30; offset += 5) {
    await Promise.all(
      Array.from({ length: 5 }, async (_, j) => {
        const r = await fetch(
          origins[0] + `/api/photo?id=${offset + j}&thumb=1`,
          { headers: { Cookie: cookies[0] } },
        );
        assert.equal(r.status, 200);
        assert.match(r.headers.get("content-type"), /image\/webp/);
        const buffer = Buffer.from(await r.arrayBuffer());
        assert.ok(buffer.length > 1000);
        assert.equal(buffer.subarray(8, 12).toString(), "WEBP");
        verified++;
      }),
    );
  }
  console.log("Verified all photo thumbnails:", verified);
  fs.writeFileSync(
    `output/transport-${origins[0].startsWith("https") ? "production" : "distributed-local"}.json`,
    JSON.stringify(
      {
        passed: true,
        instances: instanceIds.size,
        photos: verified,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  a.close();
  b.close();
  again?.close();
}
