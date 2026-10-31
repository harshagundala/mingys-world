import {
  stations,
  props,
  towers,
  lanternStands,
  tables,
  recipes,
  distance,
  riverStops,
  riverLength,
  windAt,
  fairTarget,
  throwLanding,
} from "../../src/autumn/content.ts";
import type { Role, Pose } from "../../src/autumn/content.ts";
import type { ExpeditionState } from "../../src/autumn/expeditionContent.ts";
import {
  initialExpedition,
  normalizeExpedition,
  reduceExpedition,
} from "./expedition.ts";
export type Lantern = { color: number; shape: number; wish: number };
export type State = {
  schema: 1;
  version: number;
  phase: number;
  startedAt: number;
  completedAt: number;
  players: Record<string, { id: string; name: string }>;
  ready: number[];
  collected: string[];
  bags: Record<string, string[]>;
  harvest: Record<string, number>;
  score: number[];
  timber: number;
  bridge: number;
  strokes: number[];
  turn: Role;
  challenge: null | {
    kind: "bridge" | "prep" | "cook";
    role: Role;
    start: number;
  };
  boarded: number[];
  boat: {
    progress: number;
    x: number;
    sail: number;
    at: number;
    stop: number;
    parcels: number[];
    bumps: number;
    glints: number[];
  };
  dish: null | { ingredient: string; preparedBy: Role; cooked: boolean };
  order: number;
  towers: number[];
  towerProgress: Record<string, number>;
  kite: null | { tower: number; role: Role; x: number; at: number };
  lanterns: Record<string, Lantern>;
  hands: Record<string, Lantern | null>;
  release: number[];
  fair: {
    round: number;
    throws: number[];
    scores: number[];
    shots: {
      id: string;
      role: Role;
      at: number;
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      held: number;
      points: number;
    }[];
  };
  moths: string[];
  lastAction: Record<string, number>;
  receipts: string[];
  continuousReceipts: string[];
  expedition: ExpeditionState;
};
export const initialState = (): State => ({
  schema: 1,
  version: 0,
  phase: 0,
  startedAt: Date.now(),
  completedAt: 0,
  players: {},
  ready: [],
  collected: [],
  bags: { 0: [], 1: [] },
  harvest: { apple: 0, pumpkin: 0, mushroom: 0 },
  score: [0, 0],
  timber: 0,
  bridge: 0,
  strokes: [0, 0],
  turn: 0,
  challenge: null,
  boarded: [],
  boat: {
    progress: 0,
    x: 0,
    sail: 0,
    at: 0,
    stop: 0,
    parcels: [],
    bumps: 0,
    glints: [],
  },
  dish: null,
  order: 0,
  towers: [],
  towerProgress: {},
  kite: null,
  lanterns: {},
  hands: { 0: null, 1: null },
  release: [],
  fair: { round: 0, throws: [0, 0], scores: [0, 0], shots: [] },
  moths: [],
  lastAction: {},
  receipts: [],
  continuousReceipts: [],
  expedition: initialExpedition(),
});
const boundedReceipts = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string => typeof id === "string" && id.length <= 80,
          ),
        ),
      ].slice(-96)
    : [];
const continuousActions = new Set(["sail", "kite", "exp-tick", "exp-focus"]);

/** Old saves retain their chapter; the new interlude never rewinds an existing evening. */
export function normalizeState(state: State): State {
  return {
    ...state,
    receipts: boundedReceipts(state.receipts),
    continuousReceipts: boundedReceipts(state.continuousReceipts),
    expedition: normalizeExpedition(state.expedition, state.phase),
  };
}
export type Action = {
  id: string;
  at?: number;
  kind: string;
  target?: string;
  value?: number;
  color?: number;
  shape?: number;
  wish?: number;
  held?: number;
  pitch?: number;
  phase?: number;
};
export type Result = { state: State; message?: string };
const fail = (state: State, message: string): Result => ({ state, message });
export function skillPhase(start: number, now: number) {
  return (
    (Math.sin(((now - start) / 1000) * Math.PI * 1.35 - Math.PI / 2) + 1) / 2
  );
}
export function reduce(
  input: State,
  role: Role,
  action: Action,
  poses: Record<string, Pose>,
  now = Date.now(),
): Result {
  if (
    !action ||
    typeof action.kind !== "string" ||
    typeof action.id !== "string" ||
    action.id.length > 80
  )
    return fail(input, "That action could not be read. Try again.");
  if (
    input.receipts.includes(action.id) ||
    input.continuousReceipts?.includes(action.id)
  )
    return { state: input };
  if (action.phase !== input.phase)
    return fail(input, "A new chapter has begun.");
  const p = poses[role];
  if (!p) return fail(input, "Your connection is catching up.");
  const near = (target: { x: number; z: number }, r = 4.4) =>
    p.scene === "valley" && distance(p, target) < r;
  const peer = poses[1 - role];
  const paired = !!peer && now - peer.time < 6500;
  const s = structuredClone(normalizeState(input));
  const bag = (s.bags[role] ||= []);
  const advance = () => {
    s.phase = s.phase === 5 ? 9 : s.phase === 9 ? 6 : s.phase + 1;
    s.challenge = null;
    s.bags = { 0: [], 1: [] };
    s.lastAction = {};
  };
  let message = "";
  const ack = () => {
    s.version++;
    // High-frequency controls must not evict a door/grip/use receipt whose ACK
    // was lost while the player disconnected. Both histories stay bounded.
    const history = continuousActions.has(action.kind)
      ? "continuousReceipts"
      : "receipts";
    s[history].push(action.id);
    s[history] = s[history].slice(-96);
    return { state: s, ...(message ? { message } : {}) };
  };
  const reject = (m: string) => fail(input, m);
  if (s.phase === 9) {
    const result = reduceExpedition(
      normalizeExpedition(s.expedition, s.phase),
      role,
      action,
      poses,
      now,
    );
    if (!result.changed)
      return result.message ? reject(result.message) : { state: input };
    s.expedition = result.expedition;
    message = result.message || "";
    if (result.completed) advance();
    return ack();
  }
  if (action.kind === "moth") {
    // Optional keepsakes never gate the story.
    const i = Number(action.target?.split("-")[1]);
    const target = {
      x: Math.cos(i * 2.399) * (44 + i * 2),
      z: Math.sin(i * 2.399) * (38 + i * 2),
    };
    if (
      !Number.isInteger(i) ||
      i < 0 ||
      i > 7 ||
      !near(target) ||
      s.moths.includes(action.target!)
    )
      return reject("Move closer to the little light.");
    s.moths.push(action.target!);
    message = "A little light, kept for later.";
    return ack();
  }
  if (
    s.phase === 0 &&
    action.kind === "interact" &&
    action.target === `welcome-${role}` &&
    near(stations[action.target])
  ) {
    if (!s.ready.includes(role)) s.ready.push(role);
    if (s.ready.length === 2) advance();
    else message = "Your lantern is lit. Wait for your Mingy.";
    return ack();
  }
  if ((s.phase === 1 || s.phase === 2) && action.kind === "collect") {
    const item = props.find(
      (x) => x.id === action.target && x.phase === s.phase,
    );
    if (!item || !near(item) || s.collected.includes(item.id))
      return reject("Move closer to something you can gather.");
    if (bag.length >= 3)
      return reject(
        "Your arms are full. Unload at the glowing cart or workbench.",
      );
    if (
      s.phase === 1 &&
      (!Number.isFinite(action.held) ||
        action.held! < 450 ||
        action.held! > 10000)
    )
      return reject("Hold E, then release to harvest.");
    s.collected.push(item.id);
    bag.push(item.kind);
    const quality =
      s.phase === 1 && Math.abs(skillPhase(0, action.held!) - 0.74) < 0.16;
    s.score[role] += quality ? 3 : 1;
    message = quality ? "Perfect pick. +3" : "Gathered.";
    return ack();
  }
  if (
    s.phase === 1 &&
    action.kind === "interact" &&
    action.target === "cart" &&
    near(stations.cart)
  ) {
    if (!bag.length) return reject("Bring your harvest here.");
    for (const kind of bag) s.harvest[kind] = (s.harvest[kind] || 0) + 1;
    s.bags[role] = [];
    if (["apple", "pumpkin", "mushroom"].every((k) => s.harvest[k] >= 10))
      advance();
    else message = "A little more for the fair.";
    return ack();
  }
  if (s.phase === 2 && action.target === "bench" && near(stations.bench)) {
    if (action.kind === "interact" && bag.length) {
      s.timber += bag.length;
      s.bags[role] = [];
      message = "Timber stacked.";
      return ack();
    }
    if (action.kind === "begin") {
      if (s.challenge && now - s.challenge.start < 20000)
        return reject("Your partner has the hammer.");
      if (s.timber < 3)
        return reject("This section needs three pieces of timber.");
      if (role !== s.turn) return reject("Your partner takes the next strike.");
      if (!paired)
        return reject("We will keep your place until your Mingy reconnects.");
      s.challenge = { kind: "bridge", role, start: now };
      return ack();
    }
  }
  if (action.kind === "hit" && s.challenge?.role === role) {
    const c = s.challenge;
    const target =
      c.kind === "bridge"
        ? stations.bench
        : c.kind === "prep"
          ? stations.prep
          : stations.stove;
    if (!near(target)) return reject("Stay beside your tools.");
    if (now - c.start < 250 || now - c.start > 20000) {
      s.challenge = null;
      message = "Take a breath and try again.";
      return ack();
    }
    // Score what the player saw, allowing bounded transit time rather than penalizing latency.
    const inputTime =
      Number.isFinite(action.at) &&
      action.at! <= now + 150 &&
      now - action.at! < 1400
        ? Math.min(now, action.at!)
        : now;
    const good = Math.abs(skillPhase(c.start, inputTime) - 0.74) < 0.21;
    s.challenge = null;
    // A miss is never destructive and every third attempt is assisted.
    const attempts = (s.lastAction[`attempt-${c.kind}-${role}`] || 0) + 1;
    s.lastAction[`attempt-${c.kind}-${role}`] = attempts;
    if (!good && attempts % 3 !== 0) {
      message = "Almost. Try again when the marker reaches gold.";
      return ack();
    }
    s.score[role] += good ? 2 : 1;
    if (c.kind === "bridge") {
      s.strokes[role]++;
      s.turn = (1 - role) as Role;
      if (s.strokes[0] >= 3 && s.strokes[1] >= 3) {
        s.timber -= 3;
        s.bridge++;
        s.strokes = [0, 0];
        message = "Another little piece of the way, made together.";
        if (s.bridge === 6) advance();
      }
    } else if (c.kind === "prep") {
      s.dish = {
        ingredient: recipes[s.order],
        preparedBy: role,
        cooked: false,
      };
      s.bags[role] = [];
      message = "Prepped. Your partner finishes it at the stove.";
    } else if (s.dish) {
      s.dish.cooked = true;
      message = "Ready to serve. Take it to the glowing table.";
    }
    return ack();
  }
  if (s.phase === 3) {
    if (
      action.kind === "interact" &&
      action.target === "dock" &&
      near(stations.dock)
    ) {
      if (!s.boarded.includes(role)) s.boarded.push(role);
      s.boat.at = now;
      return ack();
    }
    if (
      action.kind === "parcel" &&
      s.boarded.length === 2 &&
      s.boat.stop < 3 &&
      s.boat.progress >= riverStops[s.boat.stop]
    ) {
      if (!paired) return reject("Your parcel will wait for your Mingy.");
      if (!s.boat.parcels.includes(role)) s.boat.parcels.push(role);
      if (s.boat.parcels.length === 2) {
        s.boat.stop++;
        s.boat.parcels = [];
        s.boat.progress += 1;
        message = "Both parcels aboard. Onward.";
      }
      s.boat.at = now;
      return ack();
    }
    if (action.kind === "sail" && s.boarded.length === 2) {
      if (!Number.isFinite(action.value))
        return reject("The rudder needs a steady hand.");
      const dt = Math.min(1, Math.max(0, (now - s.boat.at) / 1000));
      const v = Math.max(-1, Math.min(1, action.value!));
      if (role === 1) {
        s.boat.sail = v;
        return ack();
      }
      s.boat.at = now;
      if (!paired) {
        return ack();
      }
      if (s.boat.stop < 3 && s.boat.progress >= riverStops[s.boat.stop])
        return ack();
      s.boat.x = Math.max(
        -8,
        Math.min(
          8,
          s.boat.x +
            v * dt * 3.3 +
            Math.sin(s.boat.progress * 0.035) * dt * 0.42,
        ),
      );
      if (Number.isFinite(peer.control)) s.boat.sail = peer.control!;
      const trim = Math.abs(s.boat.sail - windAt(s.boat.progress));
      // Full sail rewards coordination; a drifting sail still moves safely forward.
      const speed = trim < 0.24 ? 2.3 : trim < 0.55 ? 1.8 : 1.25;
      s.boat.progress = Math.min(riverLength, s.boat.progress + dt * speed);
      if (s.boat.stop < 3)
        s.boat.progress = Math.min(riverStops[s.boat.stop], s.boat.progress);
      const buoy = Math.floor(s.boat.progress / 35),
        desired = Math.sin(buoy * 2.4) * 5;
      if (
        Math.abs(s.boat.progress - buoy * 35) < 1.5 &&
        Math.abs(s.boat.x - desired) < 2.5 &&
        !s.boat.glints.includes(buoy)
      ) {
        s.boat.glints.push(buoy);
        s.score[0] += 2;
        s.score[1] += 2;
      }
      if (s.boat.progress >= riverLength) advance();
      return ack();
    }
  }
  if (s.phase === 4) {
    const target = action.target || "";
    if (
      action.kind === "ingredient" &&
      ["pantryApple", "pantryMushroom", "pantryPumpkin"].includes(target) &&
      near(stations[target])
    ) {
      if (s.dish) return reject("Finish the plate already on the stove.");
      const kind = target.slice(6).toLowerCase();
      if (kind !== recipes[s.order])
        return reject(`This order needs ${recipes[s.order]}.`);
      s.bags[role] = [kind];
      return ack();
    }
    if (
      action.kind === "begin" &&
      (target === "prep" || target === "stove") &&
      near(stations[target])
    ) {
      if (s.challenge && now - s.challenge.start < 20000)
        return reject("The kitchen is busy. Your turn is coming.");
      if (target === "prep") {
        if (s.dish)
          return reject("Your partner can finish this plate at the stove.");
        if (bag[0] !== recipes[s.order])
          return reject("Pick up the ingredient from the pantry first.");
        s.challenge = { kind: "prep", role, start: now };
      } else {
        if (!s.dish || s.dish.cooked)
          return reject("Prep a fresh plate at the cutting board first.");
        if (s.dish.preparedBy === role)
          return reject("Your partner gets to add the finishing touch.");
        s.challenge = { kind: "cook", role, start: now };
      }
      return ack();
    }
    if (
      action.kind === "serve" &&
      action.target === `table-${s.order}` &&
      near(tables[s.order])
    ) {
      if (!s.dish?.cooked)
        return reject("Your plate needs a little love at the stove first.");
      s.order++;
      s.dish = null;
      s.score[role] += 3;
      if (s.order === 8) advance();
      else message = "One very happy table.";
      return ack();
    }
  }
  if (s.phase === 5 && action.kind === "throw") {
    const pitch = stations[`pitch-${role}`];
    if (!near(pitch, 4.4)) return reject("Step up to your throwing line.");
    s.fair ||= { round: 0, throws: [0, 0], scores: [0, 0], shots: [] };
    if (s.fair.throws[role] >= 5)
      return reject("Five good throws. Cheer on your Mingy!");
    if (
      ![action.value, action.pitch, action.held].every(Number.isFinite) ||
      action.held! < 100 ||
      action.held! > 15000 ||
      Math.abs(action.pitch!) > 1.2
    )
      return reject("Hold E to charge, aim, then release.");
    if (now - (s.lastAction[`throw-${role}`] || 0) < 1400)
      return reject("Let your last pumpkin land first.");
    const landing = throwLanding(p, action.value!, action.pitch!, action.held!),
      target = fairTarget(s.fair.round, role),
      d = distance(landing, target);
    const points = d < 1.4 ? 10 : d < 3 ? 7 : d < 5 ? 4 : d < 8 ? 2 : 1;
    s.fair.throws[role]++;
    s.fair.scores[role] += points;
    s.score[role] += points;
    s.lastAction[`throw-${role}`] = now;
    s.fair.shots.push({
      id: action.id,
      role,
      at: now,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: action.value!,
      pitch: action.pitch!,
      held: action.held!,
      points,
    });
    s.fair.shots = s.fair.shots.slice(-8);
    message =
      points === 10
        ? "Right in the middle! +10"
        : `A glorious little pumpkin. +${points}`;
    if (s.fair.throws.every((n) => n >= 5)) {
      s.fair.round++;
      s.fair.throws = [0, 0];
      if (s.fair.round === 4) advance();
      else message = "New round. The rings have wandered.";
    }
    return ack();
  }
  if (s.phase === 6) {
    if (action.kind === "kite-stop" && s.kite?.role === role) {
      s.kite = null;
      return ack();
    }
    const index = Number(action.target?.split("-")[1]),
      t = towers[index];
    if (!t || s.towers.includes(index))
      return reject("Follow a tower that still needs its light.");
    if (action.kind === "kite-begin" && near({ x: t.x + 3, z: t.z })) {
      if (role !== index % 2)
        return reject("Swap jobs for this tower. Your partner takes the kite.");
      if (!paired || distance(peer, { x: t.x - 3, z: t.z }) > 3.4)
        return reject(
          "Your partner holds the amber ground switch, on the other side of this tower.",
        );
      s.kite = { tower: index, role, x: 0, at: now };
      return ack();
    }
    if (
      action.kind === "kite" &&
      s.kite?.tower === index &&
      s.kite.role === role &&
      near({ x: t.x + 3, z: t.z }, 5)
    ) {
      const dt = Math.min(1, Math.max(0, (now - s.kite.at) / 1000));
      s.kite.at = now;
      if (!Number.isFinite(action.value))
        return reject("Hold the reel steady.");
      s.kite.x = Math.max(-1, Math.min(1, action.value!));
      if (!paired || distance(peer, { x: t.x - 3, z: t.z }) > 3.4) return ack();
      const wind = Math.sin(now / 3300 + index) * 0.65;
      const good = Math.abs(s.kite.x - wind) < 0.28;
      s.towerProgress[index] = Math.min(
        1,
        (s.towerProgress[index] || 0) + dt * (good ? 1 / 50 : 1 / 230),
      );
      if (s.towerProgress[index] >= 1) {
        s.towers.push(index);
        s.kite = null;
        s.score[0] += 5;
        s.score[1] += 5;
        message = "A little more sky, untangled.";
        if (s.towers.length === 6) advance();
      }
      return ack();
    }
  }
  if (s.phase === 7) {
    if (action.kind === "craft" && near(stations.lanternTable)) {
      if (s.hands[role])
        return reject("Place the lantern you are holding first.");
      if (
        ![action.color, action.shape, action.wish].every(
          (v) => Number.isInteger(v) && v! >= 0 && v! < 6,
        )
      )
        return reject("Choose your lantern.");
      s.hands[role] = {
        color: action.color!,
        shape: action.shape! % 3,
        wish: action.wish!,
      };
      return ack();
    }
    const stand = lanternStands.find((x) => x.id === action.target);
    if (action.kind === "place" && stand && near(stand)) {
      if (stand.role !== role)
        return reject(
          "This stand is for your Mingy. Yours have your coat color.",
        );
      if (!s.hands[role]) return reject("Make a lantern at the table first.");
      if (s.lanterns[stand.id])
        return reject("This little light is already in its place.");
      s.lanterns[stand.id] = s.hands[role]!;
      s.hands[role] = null;
      return ack();
    }
    if (
      action.kind === "interact" &&
      action.target === `launch-${role}` &&
      near(stations[action.target])
    ) {
      if (Object.keys(s.lanterns).length < 12)
        return reject(
          "There is still room for a few more wishes. Twelve lanterns, six each.",
        );
      if (!paired) return reject("This moment will wait for both of you.");
      if (!s.release.includes(role)) s.release.push(role);
      if (s.release.length === 2) {
        advance();
        s.completedAt = now;
      } else message = "Your wish is ready. Wait for your Mingy.";
      return ack();
    }
  }
  return reject("Move closer to the glowing object.");
}
