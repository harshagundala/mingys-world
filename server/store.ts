import Redis from "ioredis";
import { randomUUID } from "node:crypto";

export const redis = new Redis(
  process.env.REDIS_URL || process.env.KV_URL || "redis://127.0.0.1:6379",
  { maxRetriesPerRequest: 2, connectTimeout: 8000, lazyConnect: true },
);
redis.on("error", () => {});
export const roomKey = (room: string) => `mingy:v1:${room}`;
// A separate namespace lets local QA exercise the ordinary homepage and reset
// without touching the adventure currently served by the production domain.
const worldKey = process.env.MINGY_WORLD_KEY || "mingy:public:v1";
export const publicEvents = `${worldKey}:events`;
const currentRoomKey = `${worldKey}:room`;
export async function publicRoom() {
  const candidate = randomUUID().replaceAll("-", "");
  await redis.set(currentRoomKey, candidate, "NX");
  return (await redis.get(currentRoomKey))!;
}
export async function resetPublicRoom() {
  const room = randomUUID().replaceAll("-", "");
  const previousRoom = await redis.eval(
    `local previous = redis.call('GET', KEYS[1])
     redis.call('SET', KEYS[1], ARGV[1])
     redis.call('PUBLISH', KEYS[2], ARGV[2])
     return previous`,
    2,
    currentRoomKey,
    publicEvents,
    room,
    JSON.stringify({ type: "world-reset", room }),
  );
  return { room, previousRoom: previousRoom || null };
}
