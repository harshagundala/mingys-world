import test from "node:test";
import assert from "node:assert/strict";
import {
  initialExpedition,
  normalizeExpedition,
  reduceExpedition,
} from "../server/autumn/expedition.ts";
import {
  assemblyPads,
  assemblyPairWindow,
  carryWaypoints,
  expeditionControls,
  expeditionOperator,
  focusTarget,
  heartCradle,
  heartStart,
  hollowObstacles,
  hollowSpawn,
  lightReceiverPosition,
  lightReceivers,
  lookout,
  returnPoint,
  waterReceivers,
  waterTarget,
} from "../src/autumn/expeditionContent.ts";
import { expeditionTargets } from "../src/autumn/expeditionPlay.ts";

const context = () => ({
  state: initialExpedition(),
  now: 100000,
  poses: { 0: hollowSpawn(0), 1: hollowSpawn(1) },
});
function at(c, role, point, extra = {}) {
  c.poses[role] = {
    ...c.poses[role],
    x: point.x,
    z: point.z,
    time: c.now,
    ...extra,
  };
}
function act(c, role, kind, extra = {}) {
  c.poses[role].time = c.now;
  const result = reduceExpedition(
    c.state,
    role,
    { kind, ...extra },
    c.poses,
    c.now,
  );
  c.state = result.expedition;
  return result;
}
function aim(c, role, point) {
  const p = c.poses[role],
    dx = point.x - p.x,
    dz = point.z - p.z;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2(point.y - p.y - 1.65, Math.hypot(dx, dz));
}
function chargeTick(c, route, index, delta = 200) {
  const operator = expeditionOperator(route, index),
    traveler = 1 - operator;
  c.now += delta;
  at(c, operator, expeditionControls[route]);
  at(c, traveler, (route === "water" ? waterReceivers : lightReceivers)[index]);
  if (route === "light") {
    aim(c, operator, lightReceiverPosition(index, c.now));
    act(c, traveler, "exp-focus", { value: focusTarget(index, c.now) });
  }
  return act(c, operator, "exp-tick", { value: waterTarget(index, c.now) });
}
function startStation(c, route, index) {
  const operator = expeditionOperator(route, index),
    traveler = 1 - operator;
  at(c, operator, expeditionControls[route]);
  at(c, traveler, (route === "water" ? waterReceivers : lightReceivers)[index]);
  assert.equal(
    act(c, operator, "exp-use", { target: `${route}-control` }).changed,
    true,
  );
  if (route === "light")
    assert.equal(
      act(c, traveler, "exp-use", { target: `light-focus-${index}` }).changed,
      true,
    );
}
function finishRoute(c, route) {
  for (let index = 0; index < 3; index++) {
    startStation(c, route, index);
    const charge = route === "water" ? "waterCharge" : "lightCharge";
    let attempts = 0;
    while (c.state[charge][index] < 1 && attempts++ < 200) {
      chargeTick(c, route, index);
      c.state = normalizeExpedition(JSON.parse(JSON.stringify(c.state)), 9);
    }
    assert.ok(
      attempts <= 132,
      `${route} receiver ${index} charges under coordinated input`,
    );
    assert.equal(
      act(c, 1 - expeditionOperator(route, index), "exp-collect", {
        target: `${route}-${index}`,
      }).changed,
      true,
    );
    assert.equal(c.state[route].length, index + 1);
    assert.equal(c.state.operator, null);
    assert.equal(c.state.receiver, null);
  }
}
function carryToward(c, target) {
  let steps = 0;
  while (
    Math.hypot(c.state.carry.x - target.x, c.state.carry.z - target.z) > 0.7 &&
    steps++ < 300
  ) {
    c.now += 200;
    const dx = target.x - c.state.carry.x,
      dz = target.z - c.state.carry.z,
      distance = Math.hypot(dx, dz),
      travel = Math.min(0.5, distance),
      center = {
        x: c.state.carry.x + (dx / distance) * travel,
        z: c.state.carry.z + (dz / distance) * travel,
      };
    at(c, 0, { x: center.x - 0.75, z: center.z });
    at(c, 1, { x: center.x + 0.75, z: center.z });
    act(c, 0, "exp-tick");
    c.state = normalizeExpedition(JSON.parse(JSON.stringify(c.state)), 9);
  }
  assert.ok(
    steps < 300,
    `carry reaches ${JSON.stringify(target)} through the actual wall clearance`,
  );
}
function finishExpedition(c) {
  at(c, 0, { x: heartStart.x - 0.75, z: heartStart.z });
  at(c, 1, { x: heartStart.x + 0.75, z: heartStart.z });
  act(c, 0, "exp-grip");
  act(c, 1, "exp-grip");
  for (let index = 0; index < carryWaypoints.length; index++) {
    carryToward(c, carryWaypoints[index]);
    assert.equal(c.state.carry.checkpoint, index + 1);
  }
  carryToward(c, heartCradle);
  assert.equal(act(c, 0, "exp-place").changed, true);
  assert.equal(c.state.carry.delivered, true);
  for (let index = 0; index < 3; index++) {
    at(c, 0, assemblyPads[index][0]);
    at(c, 1, assemblyPads[index][1]);
    act(c, 0, "exp-assemble");
    c.now += 1100;
    c.poses[0].time = c.now;
    act(c, 1, "exp-assemble");
    assert.equal(c.state.assembly, index + 1);
  }
  assert.equal(
    c.state.completed,
    false,
    "roof opening does not skip the celebration",
  );
  at(c, 0, returnPoint);
  at(c, 1, returnPoint);
  act(c, 0, "exp-return");
  assert.equal(c.state.completed, false);
  assert.equal(act(c, 1, "exp-return").completed, true);
}

for (const order of [
  ["water", "light"],
  ["light", "water"],
]) {
  test(`entire hollow can be completed in ${order.join(" then ")} order through serialized checkpoints`, () => {
    const c = context();
    at(c, 0, lookout);
    act(c, 0, "exp-keepsake");
    for (const route of order) finishRoute(c, route);
    assert.equal(c.state.firstRoute, order[0]);
    assert.deepEqual(c.state.routeOrder, order);
    finishExpedition(c);
    assert.deepEqual(c.state.keepsakes, [0]);
    assert.equal(
      normalizeExpedition(JSON.parse(JSON.stringify(c.state)), 9).completed,
      true,
    );
  });
}

test("water recovery requires role alternation, distance, a live partner and finite controls", () => {
  const c = context();
  at(c, 1, expeditionControls.water);
  assert.equal(
    act(c, 1, "exp-use", { target: "water-control" }).changed,
    false,
  );
  startStation(c, "water", 0);
  const initial = c.state;
  c.now += 200;
  assert.equal(act(c, 0, "exp-tick", { value: NaN }).changed, false);
  assert.equal(c.state, initial);
  c.poses[1].time = c.now - 7000;
  act(c, 0, "exp-tick", { value: waterTarget(0, c.now) });
  assert.equal(c.state.waterCharge[0], 0);
  at(c, 1, waterReceivers[0], { scene: "valley" });
  c.now += 200;
  act(c, 0, "exp-tick", { value: waterTarget(0, c.now) });
  assert.equal(c.state.waterCharge[0], 0);
  at(c, 1, waterReceivers[0], { scene: "hollow" });
  chargeTick(c, "water", 0);
  const partial = c.state.waterCharge[0];
  assert.ok(partial > 0);
  c.now += 60000;
  at(c, 0, expeditionControls.water);
  at(c, 1, waterReceivers[0]);
  act(c, 0, "exp-tick", { value: waterTarget(0, c.now) });
  assert.ok(
    c.state.waterCharge[0] - partial <= 0.75 / 26 + 1e-9,
    "a reconnect cannot fast-forward progress",
  );
  assert.equal(
    act(c, 1, "exp-collect", { target: "water-0" }).changed,
    false,
    "an incomplete receiver cannot be collected",
  );
});

test("light recovery needs concurrent aim and active fine focus; failure never erases charge", () => {
  const c = context();
  startStation(c, "light", 0);
  chargeTick(c, "light", 0);
  const partial = c.state.lightCharge[0];
  assert.ok(partial > 0);
  c.now += 200;
  at(c, 1, expeditionControls.light, { yaw: 0, pitch: -1 });
  at(c, 0, lightReceivers[0]);
  act(c, 0, "exp-focus", { value: focusTarget(0, c.now) });
  act(c, 1, "exp-tick");
  assert.equal(c.state.lightCharge[0], partial, "wrong aim does not charge");
  c.now += 200;
  aim(c, 1, lightReceiverPosition(0, c.now));
  act(c, 0, "exp-focus", { value: focusTarget(0, c.now) > 0 ? -1 : 1 });
  act(c, 1, "exp-tick");
  assert.equal(c.state.lightCharge[0], partial, "wrong focus does not charge");
  c.now += 2000;
  at(c, 0, lightReceivers[0]);
  at(c, 1, expeditionControls.light);
  aim(c, 1, lightReceiverPosition(0, c.now));
  act(c, 1, "exp-tick");
  assert.equal(
    c.state.lightCharge[0],
    partial,
    "a stopped focus stream pauses the work",
  );
  assert.equal(act(c, 0, "exp-focus", { value: Infinity }).changed, false);
  chargeTick(c, "light", 0);
  assert.ok(c.state.lightCharge[0] > partial);
});

test("instrument sessions recover from refreshed positions without losing charge", () => {
  const c = context();
  startStation(c, "light", 0);
  chargeTick(c, "light", 0);
  const partial = c.state.lightCharge[0];
  c.state = normalizeExpedition(JSON.parse(JSON.stringify(c.state)), 9);
  c.now += 60000;
  at(c, 0, hollowSpawn(0));
  at(c, 1, hollowSpawn(1));
  act(c, 1, "exp-tick");
  act(c, 0, "exp-focus", { value: 0 });
  assert.equal(c.state.operator, null);
  assert.equal(c.state.receiver, null);
  assert.equal(c.state.lightCharge[0], partial);
  startStation(c, "light", 0);
  chargeTick(c, "light", 0, 500);
  assert.ok(
    Math.abs(c.state.lightCharge[0] - partial - 0.5 / 26) < 1e-9,
    "ordinary 500ms control round trips count the active interval",
  );
});

test("carrying pauses without a partner, rejects teleporting and preserves the last checkpoint", () => {
  const c = context();
  c.state.water = [0, 1, 2];
  c.state.light = [0, 1, 2];
  at(c, 0, { x: -1, z: 18 });
  at(c, 1, { x: 1, z: 18 });
  act(c, 0, "exp-grip");
  act(c, 1, "exp-grip");
  c.now += 200;
  at(c, 0, { x: -1, z: 17 });
  c.poses[1].time = c.now - 7000;
  act(c, 0, "exp-tick");
  assert.equal(c.state.carry.z, 18);
  c.now += 200;
  at(c, 0, { x: 30, z: -20 });
  at(c, 1, { x: 32, z: -20 });
  act(c, 0, "exp-tick");
  assert.equal(c.state.carry.x, 0);
  assert.equal(c.state.carry.checkpoint, 0);
  at(c, 0, { x: -1, z: 18 });
  at(c, 1, { x: 1, z: 18 });
  carryToward(c, carryWaypoints[0]);
  assert.equal(c.state.carry.checkpoint, 1);
  act(c, 0, "exp-grip");
  const saved = normalizeExpedition(JSON.parse(JSON.stringify(c.state)), 9);
  assert.equal(saved.carry.checkpoint, 1);
  assert.equal(saved.carry.holders.length, 1);
  assert.equal(act(c, 1, "exp-place").changed, false);
});

test("carry tolerates ordinary transport latency but never teleports or moves with only one holder", () => {
  const c = context();
  c.state.water = [0, 1, 2];
  c.state.light = [0, 1, 2];
  at(c, 0, { x: -0.75, z: 18 });
  at(c, 1, { x: 0.75, z: 18 });
  act(c, 0, "exp-grip");
  c.now += 500;
  at(c, 0, { x: -0.75, z: 16 });
  at(c, 1, { x: 0.75, z: 16 });
  assert.equal(act(c, 0, "exp-tick").changed, false);
  assert.equal(c.state.carry.z, 18, "one holder cannot move the heart");
  act(c, 1, "exp-grip");
  c.now += 500;
  c.poses[1].time = c.now;
  act(c, 0, "exp-tick");
  assert.ok(
    Math.abs(c.state.carry.z - 16.6) < 1e-9,
    "500ms updates preserve 2.8m/s movement",
  );
  const before = { ...c.state.carry };
  c.now += 60000;
  at(c, 0, { x: -0.75, z: before.z - 3 });
  at(c, 1, { x: 0.75, z: before.z - 3 });
  act(c, 0, "exp-tick");
  const moved = Math.hypot(
    c.state.carry.x - before.x,
    c.state.carry.z - before.z,
  );
  assert.ok(moved <= 2.1 + 1e-9, "a reconnect can advance no more than 2.1m");
  assert.ok(
    Math.abs(moved - 2.1) < 1e-9,
    "the capped update still resumes normally",
  );
});

test("assembly requires distinct current pads and a three-second shared turn, then a separate paired return", () => {
  const c = context();
  c.state.water = [0, 1, 2];
  c.state.light = [0, 1, 2];
  c.state.carry.delivered = true;
  at(c, 0, assemblyPads[0][0]);
  at(c, 1, assemblyPads[0][1]);
  act(c, 0, "exp-assemble");
  act(c, 0, "exp-assemble");
  assert.equal(c.state.assembly, 0);
  c.now += assemblyPairWindow + 1;
  c.poses[0].time = c.now;
  act(c, 1, "exp-assemble");
  assert.equal(c.state.assembly, 0);
  act(c, 0, "exp-assemble");
  assert.equal(c.state.assembly, 1);
  assert.equal(act(c, 0, "exp-return").changed, false);
  c.state.assembly = 3;
  at(c, 0, returnPoint);
  at(c, 1, returnPoint);
  act(c, 0, "exp-return");
  at(c, 0, { x: 15, z: -62 });
  act(c, 1, "exp-return");
  assert.equal(c.state.completed, false);
  at(c, 0, returnPoint);
  assert.equal(act(c, 0, "exp-return").completed, true);
});

test("migration preserves old completed arcs and sanitizes incomplete or malformed checkpoint data", () => {
  assert.equal(normalizeExpedition(undefined, 5).completed, false);
  assert.equal(normalizeExpedition(undefined, 9).completed, false);
  for (const phase of [6, 7, 8])
    assert.equal(normalizeExpedition(undefined, phase).completed, true);
  const s = normalizeExpedition(
    {
      water: [0, 0, 2],
      light: [],
      waterCharge: [NaN, 3, -1],
      operator: { route: "water", index: 2, role: 0, value: Infinity },
      carry: { delivered: true },
      completed: true,
    },
    9,
  );
  assert.deepEqual(s.water, [0]);
  assert.deepEqual(s.waterCharge, [1, 1, 0]);
  assert.equal(s.operator, null);
  assert.equal(s.carry.delivered, false);
  assert.equal(s.completed, false);
});

test("return readiness clears an absent partner and exposes their return action after rejoining", () => {
  const c = context();
  c.state.water = [0, 1, 2];
  c.state.light = [0, 1, 2];
  c.state.carry.delivered = true;
  c.state.assembly = 3;
  at(c, 0, returnPoint);
  at(c, 1, returnPoint);
  act(c, 0, "exp-return");
  assert.ok(
    !expeditionTargets(c.state, 0).some((t) => t.action === "exp-return"),
  );
  c.state = normalizeExpedition(JSON.parse(JSON.stringify(c.state)), 9);
  c.now += 10000;
  at(c, 1, returnPoint);
  act(c, 1, "exp-return");
  assert.equal(c.state.completed, false);
  assert.deepEqual(c.state.returnReady, [1]);
  assert.ok(
    expeditionTargets(c.state, 0).some((t) => t.action === "exp-return"),
  );
  at(c, 0, returnPoint);
  assert.equal(act(c, 0, "exp-return").completed, true);
});

test("two players can follow the marked final approach without scraping the doorway", () => {
  const path = [...carryWaypoints.slice(2), heartCradle];
  for (let i = 1; i < path.length; i++)
    for (let step = 0; step <= 100; step++) {
      const t = step / 100;
      const center = {
        x: path[i - 1].x * (1 - t) + path[i].x * t,
        z: path[i - 1].z * (1 - t) + path[i].z * t,
      };
      for (const side of [-0.75, 0.75])
        assert.ok(
          !hollowObstacles.some(
            (wall) =>
              Math.abs(center.x + side - wall.x) < wall.w + 0.45 &&
              Math.abs(center.z - wall.z) < wall.d + 0.45,
          ),
          `partner clears wall at ${center.x + side},${center.z}`,
        );
    }
});

test("branch destinations, assembly pads and carry trail are reachable through the shared hollow collision contract", () => {
  const clear = (x, z) =>
    Math.abs(x) <= 80 &&
    Math.abs(z) <= 80 &&
    !hollowObstacles.some(
      (b) => Math.abs(x - b.x) < b.w + 0.35 && Math.abs(z - b.z) < b.d + 0.35,
    );
  const queue = [[0, 48]],
    seen = new Set(["0,48"]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        key = `${nx},${nz}`;
      if (!seen.has(key) && clear(nx, nz)) {
        seen.add(key);
        queue.push([nx, nz]);
      }
    }
  }
  for (const target of [
    ...Object.values(expeditionControls),
    ...waterReceivers,
    ...lightReceivers,
    ...carryWaypoints,
    ...assemblyPads.flat(),
    heartStart,
    heartCradle,
    returnPoint,
    lookout,
  ])
    assert.ok(
      seen.has(`${Math.round(target.x)},${Math.round(target.z)}`),
      `reachable ${JSON.stringify(target)}`,
    );
});
