import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { redis } from "../store.ts";
import { chooseSeat } from "../seats.ts";
import { initialState, normalizeState, reduce } from "./rules.ts";
import type { State, Action } from "./rules.ts";
import { spawn } from "../../src/autumn/content.ts";
import { hollowSpawn } from "../../src/autumn/expeditionContent.ts";
import type { Pose, Role } from "../../src/autumn/content.ts";
const instance = randomUUID();
const namespace = process.env.AUTUMN_WORLD_KEY || "mingy:autumn:v1";
const key = (room: string) => `${namespace}:${room}`;
const rooms = new Map<string, Set<any>>();
let subscriber: Redis | null = null;
const channels = new Map<string, string>();
export function send(ws: any, data: any) {
  if (ws.readyState !== 1) return;
  if (
    ["pose", "video", "voice"].includes(data.type) &&
    ws.bufferedAmount > 64000
  )
    return;
  if (ws.bufferedAmount > 500000) {
    ws.close(4000, "Refreshing connection");
    return;
  }
  ws.send(JSON.stringify(data));
}
function local(room: string, event: any) {
  for (const ws of rooms.get(room) || [])
    if (ws.connectionId !== event.exclude) send(ws, event);
}
async function relay(room: string, event: any) {
  local(room, event);
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
      try {
        const m = JSON.parse(raw);
        if (m.instance === instance) return;
        const r = channels.get(channel);
        if (!r) return;
        if (m.type === "replace") {
          for (const ws of rooms.get(r) || [])
            if (ws.connectionId === m.old)
              ws.close(4410, "Playing in another tab");
          return;
        }
        local(r, m);
      } catch {}
    });
  }
  const channel = `${key(room)}:events`;
  channels.set(channel, room);
  await subscriber.subscribe(channel);
}
export async function publicAutumnRoom() {
  const k = `${namespace}:entrance`;
  await redis.set(k, randomUUID().replaceAll("-", ""), "NX");
  return (await redis.get(k))!;
}
const saveScript = `if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('EXPIRE',KEYS[1],20) redis.call('SET',KEYS[2],ARGV[2],'EX',20) redis.call('SET',KEYS[3],ARGV[2],'EX',2592000) return 1`;
async function posesFor(room: string) {
  const values = await redis.mget(`${key(room)}:pose:0`, `${key(room)}:pose:1`);
  const out: Record<string, Pose> = {};
  values.forEach((v, i) => {
    if (v) out[i] = JSON.parse(v);
  });
  return out;
}
async function mutate(
  room: string,
  fn: (s: State) => Promise<{ state: State; message?: string }>,
) {
  const lock = `${key(room)}:lock`,
    token = randomUUID();
  let locked = false;
  for (let i = 0; i < 36; i++) {
    if (await redis.set(lock, token, "PX", 4000, "NX")) {
      locked = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 22));
  }
  if (!locked) throw new Error("One moment. Your action will retry.");
  try {
    const raw = await redis.get(key(room));
    const result = await fn(
      raw ? normalizeState(JSON.parse(raw)) : initialState(),
    );
    await redis.set(key(room), JSON.stringify(result.state));
    return result;
  } finally {
    await redis.eval(
      "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      1,
      lock,
      token,
    );
  }
}
export function attachAutumn(ws: any) {
  ws.connectionId = randomUUID();
  let room = "",
    role: Role = 0,
    id = "",
    pose = spawn(0),
    closed = false,
    joining = false,
    lastSave = 0,
    lastMove = 0,
    lastVoice = 0,
    lastVideo = 0,
    lastHeard = Date.now(),
    lastSync = 0;
  let queue = Promise.resolve();
  const save = () =>
    redis.eval(
      saveScript,
      3,
      `${key(room)}:seat:${role}`,
      `${key(room)}:pose:${role}`,
      `${key(room)}:last:${role}`,
      ws.connectionId,
      JSON.stringify({ ...pose, time: Date.now() }),
    );
  const release = async () => {
    if (!room) return;
    const released = await redis.eval(
      "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('DEL',KEYS[1],KEYS[2]) return 1",
      2,
      `${key(room)}:seat:${role}`,
      `${key(room)}:pose:${role}`,
      ws.connectionId,
    );
    if (released)
      await relay(room, { type: "left", role, exclude: ws.connectionId });
  };
  const heartbeat = setInterval(() => {
    if (closed) return;
    if (Date.now() - lastHeard > 9000) {
      ws.close(4001, "Connection heartbeat expired");
      return;
    }
    send(ws, { type: "ping", at: Date.now() });
    if (room) {
      void save().catch(() => {});
      if (Date.now() - lastSync > 3000) {
        lastSync = Date.now();
        void Promise.all([redis.get(key(room)), posesFor(room)])
          .then(([raw, poses]) => {
            if (raw)
              send(ws, {
                type: "sync",
                state: normalizeState(JSON.parse(raw)),
                poses,
                at: Date.now(),
              });
          })
          .catch(() => {});
      }
    }
  }, 1500);
  async function handle(a: any) {
    if (closed) return;
    if (a.type === "join" && !room && !joining) {
      joining = true;
      if (
        (a.room && !/^[a-zA-Z0-9_-]{20,64}$/.test(a.room)) ||
        ![0, 1].includes(a.role) ||
        !/^[a-f0-9-]{36}$/.test(a.playerId)
      ) {
        ws.close(4400, "Invalid invitation");
        return;
      }
      const target = a.room || (await publicAutumnRoom());
      let occupied = false;
      const result = await mutate(target, async (s) => {
        const seats = await redis.mget(
          `${key(target)}:seat:0`,
          `${key(target)}:seat:1`,
        );
        const assigned = chooseSeat(
          s.players,
          seats.map(Boolean),
          a.playerId,
          a.role,
        );
        if (assigned === null) {
          occupied = true;
          return { state: s };
        }
        room = target;
        role = assigned;
        id = a.playerId;
        pose = spawn(role);
        const saved = await redis.get(`${key(room)}:last:${role}`);
        if (saved) pose = JSON.parse(saved);
        if (s.phase === 9 && pose.scene !== "hollow") pose = hollowSpawn(role);
        else if (s.phase !== 9 && pose.scene === "hollow") pose = spawn(role);
        await redis.set(`${key(room)}:seat:${role}`, ws.connectionId, "EX", 20);
        await save();
        if (seats[role]) {
          for (const other of rooms.get(room) || [])
            if (other.connectionId === seats[role])
              other.close(4410, "Playing in another tab");
          await relay(room, { type: "replace", old: seats[role] });
        }
        s.players[role] = { id, name: role ? "Mingy" : "Harsha" };
        s.version++;
        return { state: s };
      });
      if (occupied) {
        send(ws, {
          type: "fatal",
          message:
            "Both seats are in use. Close an extra device and try again.",
        });
        ws.close(4409, "Full");
        return;
      }
      if (closed) {
        await release();
        return;
      }
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room)!.add(ws);
      await subscribe(room);
      const [raw, poses] = await Promise.all([
        redis.get(key(room)),
        posesFor(room),
      ]);
      send(ws, {
        type: "welcome",
        state: raw ? normalizeState(JSON.parse(raw)) : result.state,
        room,
        role,
        pose,
        poses,
        at: Date.now(),
      });
      await relay(room, {
        type: "joined",
        role,
        pose,
        exclude: ws.connectionId,
      });
      return;
    }
    if (!room) return;
    if (a.type === "pong") return;
    if (a.type === "clock") {
      send(ws, { type: "clock", sent: a.at, at: Date.now() });
      return;
    }
    if (a.type === "pose") {
      const t = Date.now(),
        p = a.pose;
      if (
        t - lastMove < 45 ||
        !p ||
        ![p.x, p.y, p.z, p.yaw, p.pitch, p.seq].every(Number.isFinite) ||
        Math.abs(p.x) > 100 ||
        Math.abs(p.z) > 100 ||
        p.y < -2 ||
        p.y > 12 ||
        !["valley", "river", "hollow"].includes(p.scene)
      )
        return;
      lastMove = t;
      pose = {
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        moving: !!p.moving,
        gesture: typeof p.gesture === "string" ? p.gesture.slice(0, 24) : "",
        gestureAt:
          Number.isFinite(p.gestureAt) && Math.abs(p.gestureAt - t) < 2000
            ? p.gestureAt
            : 0,
        seq: p.seq,
        control: Number.isFinite(p.control)
          ? Math.max(-1, Math.min(1, p.control))
          : 0,
        scene: p.scene,
        time: t,
      };
      void relay(room, {
        type: "pose",
        role,
        pose,
        exclude: ws.connectionId,
      }).catch(() => {});
      if (t - lastSave > 600) {
        lastSave = t;
        await save();
      }
      return;
    }
    if (a.type === "rtc" && JSON.stringify(a.data).length < 24000) {
      await relay(room, {
        type: "rtc",
        role,
        data: a.data,
        exclude: ws.connectionId,
      });
      return;
    }
    if (a.type === "media") {
      await relay(room, {
        type: "media",
        role,
        camera: !!a.camera,
        mic: !!a.mic,
        exclude: ws.connectionId,
      });
      return;
    }
    if (
      a.type === "video" &&
      Date.now() - lastVideo > 150 &&
      typeof a.frame === "string" &&
      a.frame.length < 32000 &&
      /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(a.frame)
    ) {
      lastVideo = Date.now();
      await relay(room, {
        type: "video",
        role,
        frame: a.frame,
        exclude: ws.connectionId,
      });
      return;
    }
    if (
      a.type === "voice" &&
      Date.now() - lastVoice > 55 &&
      typeof a.pcm === "string" &&
      a.pcm.length <= 12000 &&
      /^[A-Za-z0-9+/=]+$/.test(a.pcm)
    ) {
      lastVoice = Date.now();
      await relay(room, {
        type: "voice",
        role,
        pcm: a.pcm,
        exclude: ws.connectionId,
      });
      return;
    }
    if (a.type === "ping-mark") {
      await relay(room, {
        type: "ping-mark",
        role,
        pose,
        exclude: ws.connectionId,
      });
      return;
    }
    if (a.type === "action") {
      if (!(await save())) {
        ws.close(4410, "Playing in another tab");
        return;
      }
      const poses = await posesFor(room);
      poses[role] = { ...pose, time: Date.now() };
      const result = await mutate(room, async (s) => {
        if (
          s.players[role]?.id !== id ||
          (await redis.get(`${key(room)}:seat:${role}`)) !== ws.connectionId
        )
          throw new Error("This seat moved to another tab.");
        return reduce(s, role, a.action as Action, poses);
      });
      send(ws, {
        type: "ack",
        id: a.action?.id,
        state: result.state,
        message: result.message,
        at: Date.now(),
      });
      await relay(room, {
        type: "state",
        state: result.state,
        exclude: ws.connectionId,
      });
    }
  }
  ws.on("message", (raw: any) => {
    if (raw.length > 50000) {
      ws.close(4400, "Message too large");
      return;
    }
    let a;
    try {
      a = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!a || typeof a !== "object") return;
    lastHeard = Date.now();
    if (
      ["pose", "pong", "clock", "rtc", "video", "voice", "media"].includes(
        a.type,
      )
    ) {
      void handle(a).catch(() => {});
    } else
      queue = queue
        .then(() => handle(a))
        .catch(() =>
          send(ws, {
            type: "retry",
            id: a.action?.id,
            message: "Reconnecting. Your progress is safe.",
          }),
        );
  });
  ws.on("error", () => {});
  ws.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
    if (room) {
      rooms.get(room)?.delete(ws);
      void release().catch(() => {});
      if (!rooms.get(room)?.size) {
        rooms.delete(room);
        const c = `${key(room)}:events`;
        channels.delete(c);
        void subscriber?.unsubscribe(c);
      }
    }
  });
}
