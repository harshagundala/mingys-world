import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../server/autumn/rules.ts";
import { spawn } from "../src/autumn/content.ts";
const storage = new Map();
globalThis.window = globalThis;
window.addEventListener = () => {};
window.removeEventListener = () => {};
globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
};
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
};
globalThis.location = { protocol: "http:", host: "127.0.0.1" };
class Socket {
  readyState = 1;
  bufferedAmount = 0;
  sent = [];
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  receive(m) {
    this.onmessage({ data: JSON.stringify(m) });
  }
}
globalThis.WebSocket = Socket;
const { net } = await import("../src/autumn/network.ts");
const welcome = (state, role = 0) => ({
  type: "welcome",
  state,
  role,
  room: "qa-network-ordering-room",
  pose: spawn(role),
  poses: { 0: spawn(0), 1: spawn(1) },
  at: Date.now(),
});
test("new game preserves a newer update arriving before welcome, and ignores replaced sockets", () => {
  net.enter(0);
  const old = net.ws;
  old.receive({
    type: "state",
    state: { ...initialState(), version: 10, phase: 3 },
  });
  old.receive(welcome({ ...initialState(), version: 9 }));
  assert.equal(net.snapshot.state.phase, 3);
  net.enter(1);
  net.ws.receive(welcome({ ...initialState(), version: 11 }, 1));
  old.receive(welcome({ ...initialState(), version: 900 }));
  old.onclose({ code: 4410 });
  assert.equal(net.snapshot.role, 1);
  assert.equal(net.snapshot.state.version, 11);
  assert.equal(net.snapshot.status, "connected");
  net.leave();
});
test("server movement replaces a silently stalled open peer channel", () => {
  net.enter(0);
  net.ws.receive(welcome(initialState()));
  net.fast = { readyState: "open" };
  net.acceptPose({ ...spawn(1), x: 1, seq: 100 }, true);
  net.lastPeerPacket = Date.now() - 300;
  net.ws.receive({
    type: "pose",
    role: 1,
    pose: { ...spawn(1), x: 5, seq: 99 },
  });
  assert.equal(net.poses[1].x, 5);
  net.leave();
});
test("continuous controls stay bounded while their durable acknowledgement is pending", () => {
  net.enter(0);
  net.ws.receive(welcome({ ...initialState(), phase: 3 }));
  net.action({ kind: "sail", value: 1 });
  net.action({ kind: "sail", value: -1 });
  assert.equal(net.pending.size, 1);
  const [id] = net.pending.keys();
  net.ws.receive({
    type: "ack",
    id,
    state: { ...initialState(), version: 1, phase: 3 },
  });
  assert.equal(net.pending.size, 0);
  net.action({ kind: "sail", value: -1 });
  assert.equal(net.pending.size, 1);
  net.leave();
});
