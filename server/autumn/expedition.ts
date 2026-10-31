import {
  assemblyPads,
  assemblyPairWindow,
  carryWaypoints,
  expeditionBeamTolerance,
  expeditionChargeSeconds,
  expeditionControls,
  expeditionFocusTolerance,
  expeditionOperator,
  expeditionPathsComplete,
  expeditionPressureTolerance,
  focusTarget,
  heartCradle,
  heartStart,
  hollowObstacles,
  lightReceiverPosition,
  lightReceivers,
  lookout,
  receiverAlignment,
  returnPoint,
  waterReceivers,
  waterTarget,
} from "../../src/autumn/expeditionContent.ts";
import type {
  ExpeditionPoint,
  ExpeditionRoute,
  ExpeditionState,
} from "../../src/autumn/expeditionContent.ts";
import type { Role } from "../../src/autumn/content.ts";
export type {
  ExpeditionState,
  Expedition,
} from "../../src/autumn/expeditionContent.ts";

export type ExpeditionPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  time: number;
  scene: string;
};
export type ExpeditionAction = {
  kind: string;
  target?: string;
  value?: number;
};
export type ExpeditionResult = {
  expedition: ExpeditionState;
  changed: boolean;
  completed: boolean;
  message?: string;
};
const clamp = (n: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, n));
const finite = (n: unknown, fallback = 0) =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;
const roles = (value: unknown): Role[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((r): r is Role => r === 0 || r === 1))]
    : [];
const distance = (a: ExpeditionPoint, b: ExpeditionPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);

export function initialExpedition(): ExpeditionState {
  return {
    water: [],
    light: [],
    waterCharge: [0, 0, 0],
    lightCharge: [0, 0, 0],
    operator: null,
    receiver: null,
    firstRoute: null,
    routeOrder: [],
    carry: {
      holders: [],
      checkpoint: 0,
      ...heartStart,
      at: 0,
      delivered: false,
    },
    assembly: 0,
    assemblyReady: [],
    keepsakes: [],
    returnReady: [],
    completed: false,
    at: 0,
  };
}

/** Old adventures already beyond the interlude remain beyond it; never rewind a save. */
export function normalizeExpedition(
  value: unknown,
  legacyPhase = 0,
): ExpeditionState {
  const s = initialExpedition();
  if (!value || typeof value !== "object") {
    if (legacyPhase >= 6 && legacyPhase <= 8) {
      s.water = [0, 1, 2];
      s.light = [0, 1, 2];
      s.waterCharge = [1, 1, 1];
      s.lightCharge = [1, 1, 1];
      s.carry = {
        holders: [],
        checkpoint: 4,
        ...heartCradle,
        at: 0,
        delivered: true,
      };
      s.assembly = 3;
      s.returnReady = [0, 1];
      s.completed = true;
    }
    return s;
  }
  const old = value as Partial<ExpeditionState>;
  for (const route of ["water", "light"] as const) {
    // Checkpoints are sequential inside each independently selectable route.
    const indices = Array.isArray(old[route]) ? old[route] : [];
    let n = 0;
    while (n < 3 && indices.includes(n)) s[route].push(n++);
    const source = route === "water" ? old.waterCharge : old.lightCharge;
    const charge = route === "water" ? s.waterCharge : s.lightCharge;
    for (let i = 0; i < 3; i++)
      charge[i] = i < n ? 1 : clamp(finite(source?.[i]));
  }
  s.firstRoute =
    old.firstRoute === "water" || old.firstRoute === "light"
      ? old.firstRoute
      : null;
  s.routeOrder = Array.isArray(old.routeOrder)
    ? [
        ...new Set(
          old.routeOrder.filter(
            (r): r is ExpeditionRoute =>
              (r === "water" || r === "light") && s[r].length === 3,
          ),
        ),
      ]
    : [];
  for (const route of ["water", "light"] as const)
    if (s[route].length === 3 && !s.routeOrder.includes(route))
      s.routeOrder.push(route);
  s.firstRoute ||= s.routeOrder[0] || null;
  const op = old.operator;
  if (
    op &&
    (op.route === "water" || op.route === "light") &&
    op.index === s[op.route].length &&
    op.index < 3 &&
    op.role === expeditionOperator(op.route, op.index)
  )
    s.operator = {
      route: op.route,
      index: op.index,
      role: op.role,
      value: clamp(finite(op.value), -1, 1),
      at: Math.max(0, finite(op.at)),
    };
  const receiver = old.receiver;
  if (
    receiver &&
    receiver.index === s.light.length &&
    receiver.index < 3 &&
    receiver.role === 1 - expeditionOperator("light", receiver.index)
  )
    s.receiver = {
      index: receiver.index,
      role: receiver.role,
      value: clamp(finite(receiver.value), -1, 1),
      at: Math.max(0, finite(receiver.at)),
    };
  if (expeditionPathsComplete(s)) {
    s.carry = {
      holders: roles(old.carry?.holders),
      checkpoint: clamp(Math.floor(finite(old.carry?.checkpoint)), 0, 4),
      x: clamp(finite(old.carry?.x, heartStart.x), -80, 80),
      z: clamp(finite(old.carry?.z, heartStart.z), -80, 80),
      at: Math.max(0, finite(old.carry?.at)),
      delivered: !!old.carry?.delivered,
    };
    if (s.carry.delivered) {
      s.carry.holders = [];
      s.carry.checkpoint = 4;
      s.carry.x = heartCradle.x;
      s.carry.z = heartCradle.z;
      s.assembly = clamp(Math.floor(finite(old.assembly)), 0, 3);
      s.assemblyReady = Array.isArray(old.assemblyReady)
        ? [
            ...new Map(
              old.assemblyReady
                .filter(
                  (item) =>
                    item &&
                    (item.role === 0 || item.role === 1) &&
                    Number.isFinite(item.at),
                )
                .map((item) => [item.role, item]),
            ).values(),
          ]
        : [];
    }
  }
  s.keepsakes = roles(old.keepsakes);
  if (s.assembly === 3) s.returnReady = roles(old.returnReady);
  s.completed = s.assembly === 3 && s.returnReady.length === 2;
  s.at = Math.max(0, finite(old.at));
  return s;
}

const fresh = (
  p: ExpeditionPose | undefined,
  now: number,
): p is ExpeditionPose =>
  !!p &&
  p.scene === "hollow" &&
  [p.x, p.y, p.z, p.yaw, p.pitch, p.time].every(Number.isFinite) &&
  Math.abs(p.x) <= 83 &&
  Math.abs(p.z) <= 83 &&
  p.y >= -1 &&
  p.y <= 12 &&
  now - p.time >= -1000 &&
  now - p.time < 6500;
const near = (
  p: ExpeditionPose | undefined,
  point: ExpeditionPoint,
  now: number,
  radius = 3.8,
) => fresh(p, now) && distance(p, point) <= radius;
const clearHeart = (point: ExpeditionPoint) =>
  Math.abs(point.x) <= 80 &&
  Math.abs(point.z) <= 80 &&
  !hollowObstacles.some(
    (wall) =>
      Math.abs(point.x - wall.x) < wall.w + 0.4 &&
      Math.abs(point.z - wall.z) < wall.d + 0.4,
  );

/** The outer game reducer owns phase gating, request receipts, and version increments. */
export function reduceExpedition(
  input: ExpeditionState,
  role: Role,
  action: ExpeditionAction,
  poses: Record<string, ExpeditionPose | undefined>,
  now: number,
): ExpeditionResult {
  const unchanged = (message?: string): ExpeditionResult => ({
    expedition: input,
    changed: false,
    completed: input.completed,
    ...(message ? { message } : {}),
  });
  if (
    !action ||
    typeof action.kind !== "string" ||
    !Number.isFinite(now) ||
    (role !== 0 && role !== 1)
  )
    return unchanged();
  if (input.completed) return unchanged();
  const player = poses[role],
    peer = poses[1 - role];
  if (!fresh(player, now))
    return unchanged("Your place in the hollow is reconnecting.");
  const s = structuredClone(input);
  const done = (message?: string): ExpeditionResult => {
    s.at = now;
    return {
      expedition: s,
      changed: true,
      completed: s.completed,
      ...(message ? { message } : {}),
    };
  };
  const availableOperator = () =>
    !s.operator ||
    s.operator.role === role ||
    !near(poses[s.operator.role], expeditionControls[s.operator.route], now);

  if (action.kind === "exp-keepsake") {
    if (!near(player, lookout, now) || s.keepsakes.includes(role))
      return unchanged();
    s.keepsakes.push(role);
    return done("A little piece of this place, kept for later.");
  }

  if (action.kind === "exp-use") {
    const focusMatch = /^light-focus-([0-2])$/.exec(action.target || "");
    if (focusMatch) {
      const index = Number(focusMatch[1]);
      if (
        index !== s.light.length ||
        role === expeditionOperator("light", index)
      )
        return unchanged("Your Mingy tends this focus ring.");
      if (!near(player, lightReceivers[index], now))
        return unchanged("Move beside the focus ring.");
      if (
        s.operator?.route === "water" &&
        near(poses[s.operator.role], expeditionControls.water, now)
      )
        return unchanged(
          "Finish the open waterwork, or set its wheel down first.",
        );
      if (s.receiver?.role === role && s.receiver.index === index) {
        s.receiver = null;
        return done();
      }
      s.receiver = {
        role,
        index,
        value: s.receiver?.index === index ? s.receiver.value : 0,
        at: now,
      };
      s.firstRoute ||= "light";
      return done();
    }
    const route: ExpeditionRoute | null =
      action.target === "water-control"
        ? "water"
        : action.target === "light-control"
          ? "light"
          : null;
    if (!route) return unchanged();
    const index = s[route].length;
    if (index >= 3) return unchanged("This path is restored.");
    if (role !== expeditionOperator(route, index))
      return unchanged(
        "Trade places: your Mingy takes the controls this time.",
      );
    if (!near(player, expeditionControls[route], now))
      return unchanged("Move beside the controls.");
    if (!availableOperator())
      return unchanged(
        "Your Mingy is using the other instrument. Set it down before changing paths.",
      );
    if (s.operator?.role === role && s.operator.route === route) {
      s.operator = null;
      return done();
    }
    if (route === "water") s.receiver = null;
    s.operator = { route, index, role, value: 0, at: now };
    s.firstRoute ||= route;
    return done();
  }

  if (action.kind === "exp-focus") {
    const focus = s.receiver;
    if (!focus || focus.role !== role || focus.index !== s.light.length)
      return unchanged();
    if (!near(player, lightReceivers[focus.index], now)) {
      s.receiver = null;
      return done();
    }
    if (
      !Number.isFinite(action.value) ||
      Math.abs(action.value!) > 1 ||
      now < focus.at
    )
      return unchanged();
    focus.value = action.value!;
    focus.at = now;
    return done();
  }

  if (action.kind === "exp-tick") {
    const op = s.operator;
    if (op) {
      if (op.role !== role || now <= op.at) return unchanged();
      if (!near(player, expeditionControls[op.route], now)) {
        s.operator = null;
        return done();
      }
      // Acknowledged control streams may run near 500ms across regions. Count
      // that active interval, but never credit an entire reconnect absence.
      const dt = Math.min(0.75, (now - op.at) / 1000);
      op.at = now;
      if (op.route === "water") {
        if (!Number.isFinite(action.value) || Math.abs(action.value!) > 1)
          return unchanged();
        op.value = action.value!;
      }
      const index = op.index;
      if (index !== s[op.route].length || index >= 3) {
        s.operator = null;
        return done();
      }
      let aligned = false;
      if (op.route === "water") {
        aligned =
          near(peer, waterReceivers[index], now) &&
          Math.abs(op.value - waterTarget(index, now)) <=
            expeditionPressureTolerance;
      } else {
        const receiver = lightReceiverPosition(index, now),
          focus = s.receiver;
        aligned =
          !!focus &&
          focus.role !== role &&
          focus.index === index &&
          now - focus.at <= 1200 &&
          near(peer, lightReceivers[index], now) &&
          Math.abs(focus.value - focusTarget(index, now)) <=
            expeditionFocusTolerance &&
          receiverAlignment(player, receiver) >=
            Math.cos(expeditionBeamTolerance);
      }
      const charge = op.route === "water" ? s.waterCharge : s.lightCharge;
      if (aligned)
        charge[index] = Math.min(
          1,
          charge[index] + dt / expeditionChargeSeconds[op.route],
        );
      return done();
    }
    if (
      role !== 0 ||
      !expeditionPathsComplete(s) ||
      s.carry.delivered ||
      s.carry.holders.length !== 2
    )
      return unchanged();
    if (now <= s.carry.at) return unchanged();
    // Match normal acknowledged transport cadence without jumping across a
    // reconnect gap: speed remains 2.8m/s and each update is at most 2.1m.
    const dt = Math.min(0.75, (now - s.carry.at) / 1000);
    s.carry.at = now;
    if (
      !fresh(peer, now) ||
      !near(player, s.carry, now, 4.8) ||
      !near(peer, s.carry, now, 4.8) ||
      distance(player, peer) > 6.8
    )
      return done();
    const midpoint = { x: (player.x + peer.x) / 2, z: (player.z + peer.z) / 2 };
    const dist = distance(midpoint, s.carry);
    const fraction = dist > 0 ? Math.min(1, (2.8 * dt) / dist) : 0;
    const next = {
      x: s.carry.x + (midpoint.x - s.carry.x) * fraction,
      z: s.carry.z + (midpoint.z - s.carry.z) * fraction,
    };
    if (clearHeart(next)) {
      s.carry.x = next.x;
      s.carry.z = next.z;
    }
    if (
      s.carry.checkpoint < 4 &&
      distance(s.carry, carryWaypoints[s.carry.checkpoint]) < 3.2
    )
      s.carry.checkpoint++;
    return done();
  }

  if (action.kind === "exp-collect") {
    const match = /^(water|light)-([0-2])$/.exec(action.target || "");
    if (!match) return unchanged();
    const route = match[1] as ExpeditionRoute,
      index = Number(match[2]),
      op = s.operator;
    if (index !== s[route].length || role === expeditionOperator(route, index))
      return unchanged("Your Mingy retrieves this piece.");
    const receiver = (route === "water" ? waterReceivers : lightReceivers)[
      index
    ];
    if (!near(player, receiver, now))
      return unchanged("Move beside the restored receiver.");
    if ((route === "water" ? s.waterCharge : s.lightCharge)[index] < 1)
      return unchanged(
        "Keep working together until the receiver is fully lit.",
      );
    if (
      !op ||
      op.route !== route ||
      op.index !== index ||
      !near(peer, expeditionControls[route], now)
    )
      return unchanged(
        "Your Mingy needs to hold the instrument while you lift the piece.",
      );
    s[route].push(index);
    s.operator = null;
    s.receiver = null;
    if (s[route].length === 3 && !s.routeOrder.includes(route))
      s.routeOrder.push(route);
    return done(
      expeditionPathsComplete(s)
        ? "Both paths are awake. Meet at the glass heart."
        : index === 2
          ? "This path is awake. The other still needs you."
          : "A piece recovered. Trade places for the next one.",
    );
  }

  if (action.kind === "exp-grip") {
    if (!expeditionPathsComplete(s) || s.carry.delivered) return unchanged();
    if (s.carry.holders.includes(role)) {
      s.carry.holders = s.carry.holders.filter((r) => r !== role);
      s.carry.at = now;
      return done("Set down gently. Your progress is safe.");
    }
    if (!near(player, s.carry, now, 4))
      return unchanged("Come beside the glass heart.");
    s.carry.holders.push(role);
    s.carry.at = now;
    return done(
      s.carry.holders.length === 2
        ? "Walk together. Follow the next trail light."
        : "Hold here while your Mingy takes the other side.",
    );
  }

  if (action.kind === "exp-place") {
    if (s.carry.delivered) return unchanged();
    if (
      s.carry.checkpoint < 4 ||
      s.carry.holders.length !== 2 ||
      !near(player, heartCradle, now, 4.5) ||
      !near(peer, heartCradle, now, 5) ||
      distance(s.carry, heartCradle) > 4.6
    )
      return unchanged("Bring the heart to its cradle together.");
    s.carry = {
      ...s.carry,
      holders: [],
      x: heartCradle.x,
      z: heartCradle.z,
      delivered: true,
      at: now,
    };
    return done("Home at last. Take the two matching assembly stations.");
  }

  if (action.kind === "exp-assemble") {
    if (!s.carry.delivered || s.assembly >= 3) return unchanged();
    const pads = assemblyPads[s.assembly];
    if (!near(player, pads[role], now, 3.3))
      return unchanged("Take your marked assembly station.");
    s.assemblyReady = s.assemblyReady.filter(
      (r) =>
        now - r.at <= assemblyPairWindow &&
        now >= r.at &&
        near(poses[r.role], pads[r.role], now, 3.3),
    );
    const already = s.assemblyReady.find((r) => r.role === role);
    if (already) already.at = now;
    else s.assemblyReady.push({ role, at: now });
    if (s.assemblyReady.length === 2 && near(peer, pads[1 - role], now, 3.3)) {
      s.assembly++;
      s.assemblyReady = [];
      return done(
        s.assembly === 3
          ? "The glasshouse is opening. Stay and watch it wake."
          : "It fits. Move to the next two stations.",
      );
    }
    return done("Together on three. Your Mingy has three seconds to turn.");
  }

  if (action.kind === "exp-return") {
    if (s.assembly < 3 || !near(player, returnPoint, now)) return unchanged();
    s.returnReady = s.returnReady.filter((r) =>
      near(poses[r], returnPoint, now),
    );
    if (!s.returnReady.includes(role)) s.returnReady.push(role);
    if (s.returnReady.length === 2) s.completed = true;
    return done(
      s.completed ? "The path home is open." : "Ready when your Mingy is.",
    );
  }
  return unchanged();
}
