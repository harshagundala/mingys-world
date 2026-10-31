// Explicitly isolated development QA only. Never edits the public adventure.
import { redis } from "../server/store.ts";
import { initialState } from "../server/autumn/rules.ts";
const [room, phaseString] = process.argv.slice(2),
  phase = Number(phaseString);
if (
  !room?.startsWith("qa-") ||
  !process.env.AUTUMN_WORLD_KEY?.includes("qa-") ||
  !Number.isInteger(phase) ||
  phase < 0 ||
  phase > 8
)
  throw new Error("Use an explicit QA room and namespace.");
const key = `${process.env.AUTUMN_WORLD_KEY}:${room}`;
const token = crypto.randomUUID();
let locked = false;
for (let i = 0; i < 100; i++) {
  if (await redis.set(`${key}:lock`, token, "PX", 5000, "NX")) {
    locked = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 40));
}
if (!locked) throw new Error("QA room is busy");
const raw = await redis.get(key);
if (!raw) throw new Error("Join the QA room first.");
const old = JSON.parse(raw);
const s = {
  ...initialState(),
  phase,
  players: old.players,
  version: old.version + 100,
  bridge: phase > 2 ? 6 : 0,
  harvest: {
    apple: phase > 1 ? 10 : 0,
    pumpkin: phase > 1 ? 10 : 0,
    mushroom: phase > 1 ? 10 : 0,
  },
  order: phase > 4 ? 8 : 0,
};
if (phase === 2) {
  s.timber = 18;
}
if (phase === 3) {
  s.boarded = [0, 1];
  s.boat.at = Date.now();
}
if (phase >= 7) {
  s.towers = [0, 1, 2, 3, 4, 5];
}
if (phase === 8) {
  s.completedAt = Date.now();
  for (let i = 0; i < 12; i++)
    s.lanterns[`lantern-${i}`] = { shape: i % 3, color: i % 6, wish: i % 6 };
}
await redis.set(key, JSON.stringify(s));
await redis.publish(
  `${key}:events`,
  JSON.stringify({ type: "state", state: s, instance: "fixture" }),
);
console.log(JSON.stringify({ room, phase, version: s.version }));
await redis.eval(
  "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
  1,
  `${key}:lock`,
  token,
);
await redis.quit();
