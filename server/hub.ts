import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { initialState, reduceAction, travelTarget } from "./rules.ts";
import type { Pose, GameState } from "./rules.ts";
import { redis, roomKey as key, publicRoom, publicEvents } from "./store.ts";
import {
  chooseSeat,
  seatKey,
  savePoseScript,
  releaseSeatScript,
} from "./seats.ts";
const instance = randomUUID(),
  rooms = new Map<string, Set<any>>();
let subscriber: Redis | null = null;
function send(ws: any, data: any) {
  if (ws.readyState !== 1) return;
  const volatile = data.type === "pose" || data.type === "camera";
  if (volatile && ws.bufferedAmount > 120000) return;
  if (ws.bufferedAmount > 2000000) {
    ws.close(1013, "Connection is catching up");
    return;
  }
  ws.send(JSON.stringify(data));
}
async function relay(room: string, event: any) {
  await redis.publish(
    `${key(room)}:events`,
    JSON.stringify({ ...event, instance }),
  );
}
async function subscribe(room: string) {
  if (!subscriber) {
    subscriber = redis.duplicate();
    subscriber.on("error", () => {});
    subscriber.on("message", (channel, raw) => {
      const room = channel.split(":")[2];
      try {
        const data = JSON.parse(raw);
        if (channel === publicEvents) {
          for (const connections of rooms.values())
            for (const ws of connections) if (ws.followPublic) send(ws, data);
          return;
        }
        if (data.type === "replace-connection") {
          for (const ws of rooms.get(room) || [])
            if (ws.connectionId === data.connectionId)
              ws.close(4410, "Puppy moved to another tab");
          return;
        }
        for (const ws of rooms.get(room) || [])
          if (data.exclude !== ws.connectionId) send(ws, data);
      } catch {}
    });
    await subscriber.subscribe(publicEvents);
  }
  await subscriber.subscribe(`${key(room)}:events`);
}
async function getPoses(room: string) {
  const a = await redis.mget(`${key(room)}:pose:0`, `${key(room)}:pose:1`);
  const out: Record<string, Pose> = {};
  a.forEach((v, i) => {
    if (v) out[i] = JSON.parse(v);
  });
  return out;
}
async function mutate(
  room: string,
  fn: (
    s: GameState,
  ) => Promise<{ state: GameState; event?: any; message?: string }>,
) {
  const lock = `${key(room)}:lock`,
    token = randomUUID();
  let locked = false;
  for (let n = 0; n < 30; n++) {
    if (await redis.set(lock, token, "PX", 5000, "NX")) {
      locked = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 35));
  }
  if (!locked) throw new Error("The house is busy. Please try once more.");
  try {
    const raw = await redis.get(key(room));
    const result = await fn(raw ? JSON.parse(raw) : initialState());
    await redis.set(key(room), JSON.stringify(result.state), "EX", 604800);
    await relay(room, { type: "state", state: result.state });
    return result;
  } finally {
    await redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      1,
      lock,
      token,
    );
  }
}
export function attachSocket(ws: any, req: any) {
  let room = "",
    role = -1,
    id = "",
    pose: Pose = {
      place: "house",
      x: 0,
      y: 1,
      z: 8,
      rot: 0,
      moving: false,
      time: Date.now(),
    },
    lastSave = 0,
    lastMove = 0,
    lastCam = 0,
    joining = false;
  ws.connectionId = randomUUID();
  let disconnected = false;
  const savePose = () =>
    redis.eval(
      savePoseScript,
      3,
      seatKey(key(room), role),
      `${key(room)}:pose:${role}`,
      `${key(room)}:lastpose:${role}`,
      ws.connectionId,
      JSON.stringify({ ...pose, time: Date.now() }),
    );
  async function release() {
    if (!room || role < 0) return;
    await redis.eval(
      releaseSeatScript,
      3,
      seatKey(key(room), role),
      `${key(room)}:pose:${role}`,
      `${key(room)}:events`,
      ws.connectionId,
      JSON.stringify({
        type: "left",
        role,
        exclude: ws.connectionId,
        instance,
      }),
    );
  }
  let actionQueue = Promise.resolve();
  const helloTimeout = setTimeout(() => {
    if (!room) ws.close(4408, "Join timed out");
  }, 20000);
  const heartbeat = setInterval(() => {
    if (room) {
      send(ws, { type: "ping", at: Date.now() });
      void savePose().catch(() => {});
    }
  }, 4000);
  async function handle(a: any) {
    if (disconnected) return;
    if (a.type === "join" && !room && !joining) {
      joining = true;
      if (
        (a.room && !/^[a-zA-Z0-9_-]{20,64}$/.test(a.room)) ||
        ![0, 1].includes(a.role) ||
        !/^[a-f0-9-]{36}$/.test(a.playerId)
      ) {
        ws.close(4400, "Invalid room");
        return;
      }
      const target = a.room || (await publicRoom());
      ws.followPublic = !a.room;
      let conflict = false;
      const result = await mutate(target, async (s) => {
        if (disconnected) throw new Error("Connection closed");
        const live = await redis.mget(
          seatKey(key(target), 0),
          seatKey(key(target), 1),
          `${key(target)}:pose:0`,
          `${key(target)}:pose:1`,
        );
        const assigned = chooseSeat(
          s.players,
          [!!(live[0] || live[2]), !!(live[1] || live[3])],
          a.playerId,
          a.role,
        );
        if (assigned === null) {
          conflict = true;
          return { state: s };
        }
        room = target;
        role = assigned;
        id = a.playerId;
        const previous = await redis.mget(
          `${key(room)}:pose:${role}`,
          `${key(room)}:lastpose:${role}`,
        );
        if (previous[0] || previous[1])
          pose = JSON.parse((previous[0] || previous[1])!);
        else pose.x = role === 0 ? -0.8 : 0.8;
        // Reserve before releasing the room lock: two simultaneous arrivals
        // cannot both win the same puppy during the welcome handshake.
        await redis.set(seatKey(key(room), role), ws.connectionId, "EX", 15);
        await savePose();
        if (live[role])
          await relay(room, {
            type: "replace-connection",
            connectionId: live[role],
          });
        s.players[role] = {
          id: a.playerId,
          name: role === 0 ? "Golden boy" : "Golden girl",
        };
        s.version++;
        return { state: s };
      });
      if (conflict) {
        send(ws, {
          type: "error",
          fatal: true,
          message:
            "Both puppies are already playing. Close the game on an extra device, then try again.",
        });
        ws.close(4409, "Puppy taken");
        return;
      }
      if (disconnected) {
        await release();
        return;
      }
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room)!.add(ws);
      await subscribe(room);
      clearTimeout(helloTimeout);
      send(ws, {
        type: "welcome",
        room,
        state: result.state,
        role,
        pose,
        poses: await getPoses(room),
      });
      pose.time = Date.now();
      await savePose();
      await relay(room, {
        type: "joined",
        role,
        pose,
        exclude: ws.connectionId,
      });
      if (ws.followPublic && (await publicRoom()) !== room)
        send(ws, { type: "world-reset" });
      return;
    }
    if (!room) return;
    if (a.type === "pong") return;
    if (a.type === "pose") {
      const t = Date.now();
      if (t - lastMove < 45) return;
      lastMove = t;
      const v = a.pose;
      if (
        !v ||
        ![v.x, v.y, v.z, v.rot].every(Number.isFinite) ||
        Math.abs(v.x) > 12.5 ||
        Math.abs(v.z) > 11.5 ||
        v.y < -0.5 ||
        v.y > 8
      )
        return;
      pose = {
        place: pose.place,
        x: v.x,
        y: v.y,
        z: v.z,
        rot: v.rot,
        moving: !!v.moving,
        time: t,
      };
      await relay(room, { type: "pose", role, pose, exclude: ws.connectionId });
      if (t - lastSave > 1800) {
        lastSave = t;
        await savePose();
      }
      return;
    }
    if (a.type === "camera") {
      const t = Date.now();
      if (t - lastCam < 160) return;
      lastCam = t;
      if (
        typeof a.frame === "string" &&
        a.frame.length < 42000 &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(a.frame)
      )
        await relay(room, {
          type: "camera",
          role,
          frame: a.frame,
          exclude: ws.connectionId,
        });
      return;
    }
    if (
      a.type === "camera-off" ||
      a.type === "camera-on" ||
      a.type === "bark"
    ) {
      await relay(room, { type: a.type, role, exclude: ws.connectionId });
      return;
    }
    if (a.type === "rtc") {
      if (JSON.stringify(a.data).length < 20000)
        await relay(room, {
          type: "rtc",
          role,
          data: a.data,
          exclude: ws.connectionId,
        });
      return;
    }
    if (a.type === "action") {
      if (!(await savePose())) return;
      const poses = await getPoses(room);
      poses[role] = pose;
      const result = await mutate(room, async (s) => {
        if (
          s.players[role]?.id !== id ||
          (await redis.get(seatKey(key(room), role))) !== ws.connectionId
        )
          throw new Error(
            "This puppy joined from another tab. Refresh to reconnect.",
          );
        if (a.action.kind === "travel") {
          const target = travelTarget(s, pose, a.action.id);
          if (!target)
            return {
              state: s,
              message: "This passage is locked, or you need to move closer.",
            };
          pose = {
            place: target.place,
            x: target.position[0] + (role === 0 ? -0.8 : 0.8),
            y: target.position[1],
            z: target.position[2],
            rot: 0,
            moving: false,
            time: Date.now(),
          };
          await savePose();
          send(ws, { type: "travel", pose });
          await relay(room, {
            type: "pose",
            role,
            pose,
            exclude: ws.connectionId,
          });
          return { state: s };
        }
        return reduceAction(s, role, a.action, poses);
      });
      if (result.message) send(ws, { type: "notice", message: result.message });
    }
  }
  ws.on("message", (data: any) => {
    if (data.length > 50000) {
      ws.close(4400, "Frame too large");
      return;
    }
    let a: any;
    try {
      a = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!a || typeof a !== "object") return;
    if (
      a.type === "pose" ||
      a.type === "camera" ||
      a.type === "pong" ||
      a.type === "rtc"
    )
      void handle(a).catch(() => {});
    else
      actionQueue = actionQueue
        .then(() => handle(a))
        .catch((e) =>
          send(ws, {
            type: "error",
            message: e.message || "Connection interrupted. Try again.",
          }),
        );
  });
  ws.on("error", () => {});
  ws.on("close", () => {
    disconnected = true;
    clearInterval(heartbeat);
    clearTimeout(helloTimeout);
    if (room) {
      rooms.get(room)?.delete(ws);
      void release().catch(() => {});
      if (rooms.get(room)?.size === 0) {
        rooms.delete(room);
        void subscriber?.unsubscribe(`${key(room)}:events`);
      }
    }
  });
}
