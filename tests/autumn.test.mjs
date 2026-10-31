import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  normalizeState,
  reduce,
} from "../server/autumn/rules.ts";
import {
  assemblyPads,
  carryWaypoints,
  expeditionControls,
  expeditionOperator,
  focusTarget,
  heartCradle,
  heartStart,
  lightReceiverPosition,
  lightReceivers,
  returnPoint,
  waterReceivers,
  waterTarget,
} from "../src/autumn/expeditionContent.ts";
import {
  stations,
  props,
  towers,
  tables,
  lanternStands,
  recipes,
  spawn,
  riverStops,
  windAt,
} from "../src/autumn/content.ts";
const id = () => crypto.randomUUID();
const ctx = (phase = 0) => ({
  state: { ...initialState(), phase },
  poses: { 0: spawn(0), 1: spawn(1) },
  now: 100000,
});
function at(c, r, t) {
  c.poses[r] = { ...c.poses[r], x: t.x, z: t.z, time: c.now };
}
function act(c, r, kind, extra = {}) {
  const a = { id: id(), kind, phase: c.state.phase, ...extra };
  c.poses[r].time = c.now;
  const result = reduce(c.state, r, a, c.poses, c.now);
  c.state = result.state;
  return result;
}
function hit(c, r) {
  c.now += 500;
  return act(c, r, "hit");
}
test("autumn requires two nearby distinct players and deduplicates retried actions", () => {
  const c = ctx();
  assert.equal(
    act(c, 0, "interact", { target: "welcome-0" }).state.ready.length,
    0,
  );
  at(c, 0, stations["welcome-0"]);
  const a = { id: id(), kind: "interact", target: "welcome-0", phase: 0 };
  const first = reduce(c.state, 0, a, c.poses, c.now);
  const again = reduce(first.state, 0, a, c.poses, c.now);
  assert.equal(first.state.version, again.state.version);
  c.state = again.state;
  assert.equal(c.state.phase, 0);
  at(c, 1, stations["welcome-1"]);
  act(c, 1, "interact", { target: "welcome-1" });
  assert.equal(c.state.phase, 1);
});
test("lost discrete ACK remains idempotent after sustained controls and a serialized reconnect", () => {
  const c = ctx(9);
  for (const role of [0, 1]) c.poses[role].scene = "hollow";
  at(c, 0, expeditionControls.water);
  at(c, 1, waterReceivers[0]);
  const lostAck = {
    id: id(),
    phase: 9,
    kind: "exp-use",
    target: "water-control",
  };
  c.state = reduce(c.state, 0, lostAck, c.poses, c.now).state;
  for (let i = 0; i < 240; i++) {
    c.now += 150;
    c.poses[1].time = c.now;
    act(c, 0, "exp-tick", { value: waterTarget(0, c.now) });
  }
  assert.equal(c.state.continuousReceipts.length, 96);
  assert.ok(c.state.receipts.includes(lostAck.id));
  c.state = normalizeState(JSON.parse(JSON.stringify(c.state)));
  const restored = c.state;
  c.now += 30000;
  at(c, 0, expeditionControls.water);
  at(c, 1, waterReceivers[0]);
  c.state = reduce(c.state, 0, lostAck, c.poses, c.now).state;
  assert.equal(
    c.state,
    restored,
    "replaying the original claim must not release the instrument",
  );
  assert.equal(c.state.expedition.operator?.role, 0);
  const legacy = JSON.parse(JSON.stringify(c.state));
  delete legacy.continuousReceipts;
  assert.deepEqual(normalizeState(legacy).continuousReceipts, []);
  const oversized = Array.from({ length: 300 }, (_, i) => `receipt-${i}`);
  const bounded = normalizeState({
    ...c.state,
    receipts: oversized,
    continuousReceipts: oversized,
  });
  assert.equal(bounded.receipts.length, 96);
  assert.equal(bounded.continuousReceipts.length, 96);
});
test("harvest capacity, spatial and chapter gates retain progress on bad actions", () => {
  const c = ctx(1);
  for (const p of props.slice(0, 4)) {
    at(c, 0, p);
    act(c, 0, "collect", { target: p.id, held: 500 });
  }
  assert.equal(c.state.bags[0].length, 3);
  assert.equal(c.state.collected.length, 3);
  at(c, 0, stations.cart);
  act(c, 0, "interact", { target: "cart" });
  assert.equal(c.state.bags[0].length, 0);
  assert.deepEqual(c.state.harvest, { apple: 1, pumpkin: 1, mushroom: 1 });
  const before = c.state;
  assert.equal(
    reduce(
      before,
      0,
      { id: id(), kind: "interact", target: "launch-0", phase: 7 },
      c.poses,
      c.now,
    ).state,
    before,
  );
});
test("full two-player progression is completable without skips and serializes through every checkpoint", () => {
  const c = ctx();
  for (const r of [0, 1]) {
    at(c, r, stations[`welcome-${r}`]);
    act(c, r, "interact", { target: `welcome-${r}` });
  }
  assert.equal(c.state.phase, 1);
  for (let i = 0; i < 30; i++) {
    const r = i % 2,
      p = props[i];
    at(c, r, p);
    act(c, r, "collect", { target: p.id, held: 500 });
    if (c.state.bags[r].length === 3) {
      at(c, r, stations.cart);
      act(c, r, "interact", { target: "cart" });
    }
  }
  for (const r of [0, 1]) {
    at(c, r, stations.cart);
    act(c, r, "interact", { target: "cart" });
  }
  assert.equal(c.state.phase, 2);
  for (let i = 0; i < 18; i++) {
    const r = i % 2,
      p = props.find((p) => p.id === `wood-${i}`);
    at(c, r, p);
    act(c, r, "collect", { target: p.id });
    if (c.state.bags[r].length === 3) {
      at(c, r, stations.bench);
      act(c, r, "interact", { target: "bench" });
    }
  }
  for (const r of [0, 1]) {
    at(c, r, stations.bench);
    act(c, r, "interact", { target: "bench" });
  }
  assert.equal(c.state.timber, 18);
  for (let i = 0; i < 36; i++) {
    const r = c.state.turn;
    at(c, 0, stations.bench);
    at(c, 1, stations.bench);
    act(c, r, "begin", { target: "bench" });
    assert.ok(c.state.challenge);
    hit(c, r);
    c.state = JSON.parse(JSON.stringify(c.state));
  }
  assert.equal(c.state.phase, 3);
  assert.equal(c.state.bridge, 6);
  for (const r of [0, 1]) {
    at(c, r, stations.dock);
    act(c, r, "interact", { target: "dock" });
  }
  assert.equal(c.state.boarded.length, 2);
  let steps = 0;
  while (c.state.phase === 3 && steps++ < 8000) {
    c.now += 500;
    c.poses[1].time = c.now;
    act(c, 1, "sail", { value: windAt(c.state.boat.progress) });
    act(c, 0, "sail", { value: 0 });
    if (
      c.state.boat.stop < 3 &&
      c.state.boat.progress >= riverStops[c.state.boat.stop]
    ) {
      act(c, 0, "parcel");
      act(c, 1, "parcel");
    }
  }
  assert.equal(c.state.phase, 4);
  assert.equal(c.state.boat.stop, 3);
  for (let i = 0; i < 8; i++) {
    const r = i % 2,
      other = 1 - r,
      ingredient = recipes[i],
      pantry = `pantry${ingredient[0].toUpperCase()}${ingredient.slice(1)}`;
    at(c, r, stations[pantry]);
    act(c, r, "ingredient", { target: pantry });
    at(c, r, stations.prep);
    act(c, r, "begin", { target: "prep" });
    hit(c, r);
    assert.ok(c.state.dish);
    at(c, other, stations.stove);
    act(c, other, "begin", { target: "stove" });
    hit(c, other);
    assert.equal(c.state.dish.cooked, true);
    at(c, r, tables[i]);
    act(c, r, "serve", { target: tables[i].id });
  }
  assert.equal(c.state.phase, 5);
  for (let round = 0; round < 4; round++)
    for (let shot = 0; shot < 5; shot++)
      for (const r of [0, 1]) {
        at(c, r, stations[`pitch-${r}`]);
        c.now += 1500;
        act(c, r, "throw", { held: 900, value: 0, pitch: 0.5 });
      }
  assert.equal(c.state.phase, 9);
  // Drive the added chapter through the same authoritative reducer and request
  // receipts as a real two-player session; every beat survives JSON reloads.
  for (const r of [0, 1]) c.poses[r].scene = "hollow";
  for (const route of ["light", "water"])
    for (let index = 0; index < 3; index++) {
      const operator = expeditionOperator(route, index),
        traveler = 1 - operator;
      at(c, operator, expeditionControls[route]);
      at(
        c,
        traveler,
        (route === "water" ? waterReceivers : lightReceivers)[index],
      );
      act(c, operator, "exp-use", { target: `${route}-control` });
      if (route === "light")
        act(c, traveler, "exp-use", { target: `light-focus-${index}` });
      const charge = route === "water" ? "waterCharge" : "lightCharge";
      let ticks = 0;
      while (c.state.expedition[charge][index] < 1 && ticks++ < 200) {
        c.now += 200;
        c.poses[0].time = c.poses[1].time = c.now;
        if (route === "light") {
          const receiver = lightReceiverPosition(index, c.now),
            p = c.poses[operator],
            dx = receiver.x - p.x,
            dz = receiver.z - p.z;
          p.yaw = Math.atan2(-dx, -dz);
          p.pitch = Math.atan2(receiver.y - p.y - 1.65, Math.hypot(dx, dz));
          act(c, traveler, "exp-focus", { value: focusTarget(index, c.now) });
        }
        act(c, operator, "exp-tick", { value: waterTarget(index, c.now) });
        c.state = normalizeState(JSON.parse(JSON.stringify(c.state)));
      }
      assert.ok(ticks < 200, `joint ${route} receiver ${index} finishes`);
      act(c, traveler, "exp-collect", { target: `${route}-${index}` });
      assert.equal(c.state.expedition[route].length, index + 1);
    }
  assert.deepEqual(c.state.expedition.routeOrder, ["light", "water"]);
  for (const r of [0, 1]) {
    at(c, r, { x: heartStart.x + (r ? 0.75 : -0.75), z: heartStart.z });
    act(c, r, "exp-grip");
  }
  for (const waypoint of [...carryWaypoints, heartCradle]) {
    let ticks = 0;
    while (
      Math.hypot(
        c.state.expedition.carry.x - waypoint.x,
        c.state.expedition.carry.z - waypoint.z,
      ) > 0.7 &&
      ticks++ < 300
    ) {
      c.now += 200;
      const heart = c.state.expedition.carry,
        dx = waypoint.x - heart.x,
        dz = waypoint.z - heart.z,
        length = Math.hypot(dx, dz),
        step = Math.min(0.5, length),
        x = heart.x + (dx / length) * step,
        z = heart.z + (dz / length) * step;
      at(c, 0, { x: x - 0.75, z });
      at(c, 1, { x: x + 0.75, z });
      act(c, 0, "exp-tick");
      c.state = normalizeState(JSON.parse(JSON.stringify(c.state)));
    }
    assert.ok(
      ticks < 300,
      "the shared heart clears every wall and reaches its next checkpoint",
    );
  }
  act(c, 0, "exp-place");
  assert.equal(c.state.expedition.carry.delivered, true);
  for (let index = 0; index < 3; index++) {
    at(c, 0, assemblyPads[index][0]);
    at(c, 1, assemblyPads[index][1]);
    act(c, 0, "exp-assemble");
    c.now += 1000;
    c.poses[0].time = c.now;
    act(c, 1, "exp-assemble");
    c.state = normalizeState(JSON.parse(JSON.stringify(c.state)));
    assert.equal(c.state.expedition.assembly, index + 1);
  }
  assert.equal(
    c.state.phase,
    9,
    "roof reveal remains available until both choose to leave",
  );
  at(c, 0, returnPoint);
  at(c, 1, returnPoint);
  act(c, 0, "exp-return");
  act(c, 1, "exp-return");
  assert.equal(c.state.phase, 6);
  assert.equal(c.state.expedition.completed, true);
  for (const r of [0, 1]) c.poses[r].scene = "valley";
  for (let i = 0; i < 6; i++) {
    const r = i % 2,
      t = towers[i];
    at(c, r, { x: t.x + 3, z: t.z });
    at(c, 1 - r, { x: t.x - 3, z: t.z });
    act(c, r, "kite-begin", { target: t.id });
    assert.ok(c.state.kite);
    for (let k = 0; k < 140 && !c.state.towers.includes(i); k++) {
      c.now += 400;
      c.poses[1 - r].time = c.now;
      act(c, r, "kite", {
        target: t.id,
        value: Math.sin(c.now / 3300 + i) * 0.65,
      });
    }
    assert.ok(c.state.towers.includes(i));
  }
  assert.equal(c.state.phase, 7);
  for (const l of lanternStands) {
    const r = l.role;
    at(c, r, stations.lanternTable);
    act(c, r, "craft", { color: 2, shape: 1, wish: 4 });
    assert.ok(c.state.hands[r]);
    at(c, r, l);
    act(c, r, "place", { target: l.id });
    assert.equal(c.state.hands[r], null);
  }
  assert.equal(Object.keys(c.state.lanterns).length, 12);
  for (const r of [0, 1]) {
    at(c, r, stations[`launch-${r}`]);
    c.poses[1 - r].time = c.now;
    act(c, r, "interact", { target: `launch-${r}` });
  }
  assert.equal(c.state.phase, 8);
  assert.ok(c.state.completedAt);
  assert.equal(c.state.order, 8);
});
test("new adventures enter the hollow while migration never rewinds a legacy later chapter", () => {
  const c = ctx(5);
  c.state.fair.round = 3;
  c.state.fair.throws = [5, 4];
  at(c, 0, stations["pitch-0"]);
  at(c, 1, stations["pitch-1"]);
  c.now += 1500;
  act(c, 1, "throw", { held: 900, value: 0, pitch: 0.5 });
  assert.equal(c.state.phase, 9);
  assert.equal(c.state.expedition.completed, false);
  for (const phase of [6, 7, 8]) {
    const legacy = { ...initialState(), phase };
    delete legacy.expedition;
    const migrated = normalizeState(legacy);
    assert.equal(migrated.phase, phase);
    assert.equal(migrated.expedition.completed, true);
  }
});
test("boat and kite pause on a disconnected partner, without consuming existing work", () => {
  const c = ctx(3);
  c.state.boarded = [0, 1];
  c.state.boat.at = c.now - 500;
  c.poses[1].time = c.now - 10000;
  act(c, 0, "sail", { value: 1 });
  assert.equal(c.state.boat.progress, 0);
  c.state.phase = 6;
  at(c, 0, { x: towers[0].x + 3, z: towers[0].z });
  assert.equal(act(c, 0, "kite-begin", { target: "tower-0" }).state.kite, null);
});
test("cooking demands a partner handoff; a failed timing attempt never destroys a dish", () => {
  const c = ctx(4);
  c.state.dish = { ingredient: "apple", preparedBy: 0, cooked: false };
  at(c, 0, stations.stove);
  assert.equal(act(c, 0, "begin", { target: "stove" }).state.challenge, null);
  at(c, 1, stations.stove);
  act(c, 1, "begin", { target: "stove" });
  c.now += 1200;
  act(c, 1, "hit");
  assert.ok(c.state.dish);
  assert.equal(c.state.order, 0);
});
test("lanterns cannot be placed in a partner stand or released before all twelve exist", () => {
  const c = ctx(7);
  at(c, 0, stations.lanternTable);
  act(c, 0, "craft", { color: 0, shape: 1, wish: 0 });
  at(c, 0, lanternStands[1]);
  act(c, 0, "place", { target: lanternStands[1].id });
  assert.ok(c.state.hands[0]);
  assert.equal(Object.keys(c.state.lanterns).length, 0);
  at(c, 0, stations["launch-0"]);
  act(c, 0, "interact", { target: "launch-0" });
  assert.equal(c.state.phase, 7);
});

test("timing uses a bounded input timestamp so transport latency cannot turn a visible hit into a miss", () => {
  const c = ctx(2);
  c.state.timber = 3;
  at(c, 0, stations.bench);
  at(c, 1, stations.bench);
  act(c, 0, "begin", { target: "bench" });
  const started = c.now;
  c.now += 1100;
  act(c, 0, "hit", { at: started + 500 });
  assert.deepEqual(c.state.strokes, [1, 0]);
});
test("all supplies and serving tables are outside solid buildings", async () => {
  const { obstacles } = await import("../src/autumn/content.ts");
  for (const p of [...props, ...tables])
    for (const b of obstacles)
      assert.ok(
        !(Math.abs(p.x - b.x) < b.w && Math.abs(p.z - b.z) < b.d),
        `${p.id} overlaps a building`,
      );
});
