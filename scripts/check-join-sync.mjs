/** Real Redis, isolated rooms, and a delayed subscription reproduce a slow join. */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { redis } from "../server/store.ts";
import { attachSocket } from "../server/hub.ts";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const duplicate = redis.duplicate.bind(redis),
  subscribers = [];
redis.duplicate = (...args) => {
  const sub = duplicate(...args);
  subscribers.push(sub);
  const subscribe = sub.subscribe.bind(sub);
  sub.subscribe = async (...a) => {
    await sleep(300);
    return subscribe(...a);
  };
  return sub;
};
class Socket extends EventEmitter {
  readyState = 1;
  bufferedAmount = 0;
  events = [];
  send(raw) {
    this.events.push(JSON.parse(raw));
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit("close");
  }
}
const room = "qa-delayed-join-" + randomUUID(),
  pair = [new Socket(), new Socket()];
try {
  for (const [i, ws] of pair.entries()) {
    attachSocket(ws, {});
    ws.emit(
      "message",
      Buffer.from(
        JSON.stringify({ type: "join", room, role: i, playerId: randomUUID() }),
      ),
    );
  }
  for (
    let i = 0;
    i < 100 && !pair.every((ws) => ws.events.some((e) => e.type === "welcome"));
    i++
  )
    await sleep(50);
  for (const ws of pair) {
    const welcome = ws.events.find((e) => e.type === "welcome");
    assert.ok(welcome, "both delayed connections receive a welcome");
    assert.equal(
      Object.keys(welcome.state.players).length,
      2,
      "welcome catches the partner who joined during subscription",
    );
    assert.equal(welcome.state.version, 2);
  }
  console.log(
    "PASS slow simultaneous joins both receive the current shared state.",
  );
} finally {
  pair.forEach((ws) => ws.close());
  await sleep(150);
  for (const sub of subscribers) await sub.quit();
  await redis.quit();
}
