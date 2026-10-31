import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reduce } from "../server/autumn/rules.ts";
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
  assert.equal(c.state.phase, 6);
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
