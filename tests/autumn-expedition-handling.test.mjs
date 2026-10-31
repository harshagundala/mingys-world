import test from "node:test";
import assert from "node:assert/strict";
import { expeditionHandMode } from "../src/autumn/expeditionHandling.ts";
import { initialExpedition } from "../server/autumn/expedition.ts";
const state = () => ({ phase: 9, expedition: initialExpedition() });
test("hands belong to the actual local operator and do not leak across phases", () => {
  const s = state();
  s.expedition.operator = {
    route: "water",
    role: 0,
    index: 0,
    value: 0.6,
    at: 100,
  };
  assert.deepEqual(expeditionHandMode(s, 0), {
    mode: "pump",
    pressure: 0.6,
    step: 0,
  });
  assert.equal(expeditionHandMode(s, 1).mode, "");
  s.expedition.operator.route = "light";
  assert.equal(expeditionHandMode(s, 0).mode, "lamp");
  s.expedition.receiver = { role: 1, index: 0, value: -0.4, at: 100 };
  assert.deepEqual(expeditionHandMode(s, 1), {
    mode: "focus",
    pressure: -0.4,
    step: 0,
  });
  assert.equal(expeditionHandMode({ ...s, phase: 8 }, 0).mode, "");
  assert.equal(expeditionHandMode(undefined, 0).mode, "");
  for (const value of [Infinity, NaN, -4, 5]) {
    s.expedition.operator.value = value;
    s.expedition.receiver.value = value;
    for (const role of [0, 1])
      assert.ok(Math.abs(expeditionHandMode(s, role).pressure) <= 1);
  }
});
test("carriers keep both hands available until delivery and visual projection is read only", () => {
  const s = state();
  s.expedition.carry.holders = [0, 1];
  const before = structuredClone(s);
  for (const role of [0, 1])
    assert.equal(expeditionHandMode(s, role).mode, "carry");
  assert.deepEqual(s, before);
  s.expedition.carry.delivered = true;
  for (const role of [0, 1]) assert.equal(expeditionHandMode(s, role).mode, "");
});
test("paired assembly grip expires with its three-second input window and never replays stale gestures", () => {
  const s = state();
  s.expedition.assemblyReady = [{ role: 0, at: 1000 }];
  assert.equal(expeditionHandMode(s, 0, "", -1, 3999).mode, "assemble");
  assert.equal(expeditionHandMode(s, 0, "", -1, 4000).mode, "");
  assert.equal(expeditionHandMode(s, 1, "", -1, 2000).mode, "");
  s.expedition.assemblyReady = [];
  assert.equal(
    expeditionHandMode(s, 0, "exp-assemble", 0.4, 4000).mode,
    "assemble",
  );
  for (const age of [-1, 0.85, 8, NaN, Infinity])
    assert.equal(expeditionHandMode(s, 0, "exp-assemble", age, 4000).mode, "");
});
