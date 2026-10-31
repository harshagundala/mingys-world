import test from "node:test";
import assert from "node:assert/strict";
import {
  toolImpact,
  throwHandling,
  harvestHandling,
} from "../src/autumn/actionMotion.ts";

test("throw handling releases the held prop, recovers once, and never hides it on old timestamps", () => {
  assert.equal(throwHandling(-1, 1000).objectVisible, true);
  assert.ok(throwHandling(-1, 1000).draw > 0.8);
  assert.equal(throwHandling(0.2, 0).objectVisible, false);
  assert.ok(throwHandling(0.2, 0).follow > 0.5);
  assert.equal(throwHandling(0.7, 0).objectVisible, true);
  assert.ok(
    throwHandling(0.7, 0).reveal > 0 && throwHandling(0.7, 0).reveal < 1,
  );
  for (const age of [-100, 10, 10000, NaN, Infinity]) {
    const motion = throwHandling(age, 0);
    assert.equal(motion.objectVisible, true);
    assert.equal(motion.reveal, 1);
    assert.equal(motion.follow, 0);
  }
});
test("impact animation has anticipation and a single contact followed by a bounded, non-looping recovery", () => {
  assert.ok(toolImpact(0.06) < 0);
  assert.ok(toolImpact(0.21) > 0.99);
  assert.equal(toolImpact(1), 0);
  assert.equal(toolImpact(1000), 0);
  assert.equal(toolImpact(NaN), 0);
  for (let i = 0; i < 1000; i++) {
    const value = toolImpact(i / 1000);
    assert.ok(Number.isFinite(value) && value >= -0.23 && value <= 1.001);
  }
});
test("harvest grip reaches while held and returns to neutral after release without altering charge mechanics", () => {
  assert.equal(harvestHandling(1000, -1).reach, 1);
  assert.equal(harvestHandling(0, 0).reach, 1);
  assert.ok(
    harvestHandling(0, 0.3).reach > 0 && harvestHandling(0, 0.3).reach < 1,
  );
  assert.deepEqual(harvestHandling(0, 3), { reach: 0, twist: 0 });
  assert.deepEqual(harvestHandling(0, NaN), { reach: 0, twist: 0 });
});
