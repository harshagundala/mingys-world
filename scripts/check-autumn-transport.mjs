import WebSocket from "ws";
import assert from "node:assert/strict";
const origin = process.argv[2] || "http://127.0.0.1:5173",
  room = `qa-${crypto.randomUUID()}`,
  ids = [crypto.randomUUID(), crypto.randomUUID()];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Peer {
  constructor(role) {
    this.role = role;
    this.messages = [];
    this.state = null;
  }
  async open() {
    this.ws = new WebSocket(
      origin.replace(/^http/, "ws") + "/api/ws?game=autumn",
    );
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      this.messages.push(m);
      if (m.state && (!this.state || m.state.version >= this.state.version))
        this.state = m.state;
      if (m.type === "ping") this.send({ type: "pong" });
    });
    await new Promise((r, j) => {
      this.ws.once("open", r);
      this.ws.once("error", j);
    });
    this.send({
      type: "join",
      room,
      role: this.role,
      playerId: ids[this.role],
    });
    await this.wait((m) => m.type === "welcome");
  }
  send(m) {
    this.ws.send(JSON.stringify(m));
  }
  async wait(fn, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const m = this.messages.find(fn);
      if (m) return m;
      await sleep(20);
    }
    throw new Error("Timed out " + JSON.stringify(this.messages.slice(-2)));
  }
  pose(x, z) {
    this.send({
      type: "pose",
      pose: {
        x,
        y: 0,
        z,
        yaw: 0,
        pitch: 0,
        moving: false,
        time: Date.now(),
        seq: Date.now(),
        scene: "valley",
      },
    });
  }
  async action(kind, target, id = crypto.randomUUID()) {
    this.send({
      type: "action",
      action: { id, phase: this.state.phase, kind, target },
    });
    return await this.wait((m) => m.type === "ack" && m.id === id);
  }
}
const a = new Peer(0),
  b = new Peer(1);
try {
  await Promise.all([a.open(), b.open()]);
  assert.notEqual(a.role, b.role);
  a.pose(-3, 32);
  b.pose(3, 32);
  await sleep(90);
  const ack = await a.action("interact", "welcome-0");
  const original = ack.state.version;
  a.messages = [];
  await a.action("interact", "welcome-0", ack.id);
  assert.equal(a.state.version, original, "ACK replay must be idempotent");
  await b.action("interact", "welcome-1");
  await a.wait((m) => m.state?.phase === 1);
  assert.equal(a.state.phase, 1);
  a.pose(-8, 20);
  await sleep(150);
  await b.wait((m) => m.type === "pose" && m.pose.x === -8);
  const version = a.state.version;
  a.ws.close();
  await sleep(300);
  a.messages = [];
  await a.open();
  assert.equal(a.state.phase, 1);
  assert.ok(a.state.version >= version);
  const welcome = a.messages.find((m) => m.type === "welcome");
  assert.ok(Math.abs(welcome.pose.x - -8) < 0.1, "pose is restored");
  a.send({ type: "video", frame: "data:image/jpeg;base64,/9j/2Q==" });
  await b.wait((m) => m.type === "video");
  a.send({ type: "voice", pcm: "AAAAAA==" });
  await b.wait((m) => m.type === "voice");
  const third = new WebSocket(
    origin.replace(/^http/, "ws") + "/api/ws?game=autumn",
  );
  await new Promise((r, j) => {
    third.on("open", () =>
      third.send(
        JSON.stringify({
          type: "join",
          room,
          role: 0,
          playerId: crypto.randomUUID(),
        }),
      ),
    );
    third.on("close", (code) => {
      try {
        assert.equal(code, 4409);
        r();
      } catch (e) {
        j(e);
      }
    });
    third.on("error", j);
  });
  console.log(
    JSON.stringify({
      ok: true,
      origin,
      room,
      checks: [
        "shared join",
        "two seats",
        "idempotent ACK",
        "cooperative transition",
        "movement relay",
        "disconnect and restored checkpoint",
        "restored position",
        "video relay",
        "voice relay",
        "third-device rejection",
      ],
    }),
  );
} finally {
  a.ws?.close();
  b.ws?.close();
}
