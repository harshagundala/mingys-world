import assert from "node:assert/strict";
import { test, after } from "node:test";
import { initialState } from "../server/rules.ts";
const saved = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => saved.get(k) ?? null,
  setItem: (k, v) => saved.set(k, v),
};
globalThis.location = { protocol: "http:", host: "127.0.0.1" };
class Socket {
  readyState = 1;
  bufferedAmount = 0;
  sent = [];
  send(raw) {
    this.sent.push(JSON.parse(raw));
  }
  close() {
    this.readyState = 3;
  }
  receive(value) {
    this.onmessage({ data: JSON.stringify(value) });
  }
}
globalThis.WebSocket = Socket;
const { session } = await import("../src/network/session.ts");
const room = "qa-connection-state-ordering";
const pose = {
  place: "house",
  x: 0,
  y: 0,
  z: 8,
  rot: 0,
  moving: false,
  time: 1,
};
const welcome = (state, actualRoom = room) => ({
  type: "welcome",
  room: actualRoom,
  state,
  role: 0,
  pose,
  poses: { 0: pose },
});
after(() => session.leave());
test("an update received during welcome cannot be rolled back by an older welcome snapshot", () => {
  session.enter(room, 0);
  const newer = {
    ...initialState(),
    version: 3,
    chapter: 1,
    found: ["clock-a"],
  };
  session.ws.receive({ type: "state", state: newer });
  session.ws.receive(welcome({ ...initialState(), version: 2 }));
  assert.deepEqual(session.snapshot.state, newer);
  session.leave();
});
test("reconnecting after public reset accepts a fresh room despite its lower version", () => {
  session.enter("", 0);
  session.ws.receive(
    welcome({ ...initialState(), version: 40, chapter: 4 }, "qa-before-reset"),
  );
  session.connect();
  const fresh = { ...initialState(), version: 1 };
  session.ws.receive(welcome(fresh, "qa-after-reset"));
  assert.equal(session.snapshot.room, "qa-after-reset");
  assert.deepEqual(session.snapshot.state, fresh);
  session.leave();
});
test("late messages and close events from a replaced socket cannot affect its replacement", () => {
  session.enter(room, 0);
  const old = session.ws;
  session.enter(room, 1);
  const current = session.ws;
  current.receive({ ...welcome({ ...initialState(), version: 5 }), role: 1 });
  old.receive(welcome({ ...initialState(), version: 100, chapter: 8 }));
  old.onclose({ code: 4410 });
  assert.equal(session.snapshot.role, 1);
  assert.equal(session.snapshot.state.version, 5);
  assert.equal(session.snapshot.status, "connected");
  session.leave();
});
