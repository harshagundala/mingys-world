import test from "node:test";
import assert from "node:assert/strict";
import { wildlifePlan, wildlifeHomes } from "../src/autumn/wildlifeBehavior.ts";
import { obstacles } from "../src/autumn/content.ts";
test("wildlife routes match across clients and remain in safe clearings", () => {
  for (const animal of wildlifeHomes)
    for (let t = 0; t < 600; t += 0.37) {
      const plan = wildlifePlan(animal, t, [], 2);
      assert.deepEqual(plan, wildlifePlan(animal, t, [], 2));
      assert.ok(Math.hypot(plan.x - animal.x, plan.z - animal.z) < 6);
      assert.ok(plan.z > -55);
      assert.ok(
        obstacles.every(
          (b) =>
            Math.abs(plan.x - b.x) >= b.w + 0.75 ||
            Math.abs(plan.z - b.z) >= b.d + 0.75,
        ),
      );
    }
});
test("quiet two-player encounter is optional and movement startles wildlife safely", () => {
  const rabbit = wildlifeHomes[2];
  const players = [
    { x: rabbit.x + 4, z: rabbit.z, moving: false },
    { x: rabbit.x + 5, z: rabbit.z + 1, moving: false },
  ];
  const calm = wildlifePlan(rabbit, 0, players, 1);
  assert.equal(calm.curious, true);
  assert.equal(calm.leaf, true);
  assert.equal(wildlifePlan(rabbit, 0, [players[0]], 1).leaf, false);
  const startled = wildlifePlan(
    rabbit,
    0,
    [{ ...players[0], x: rabbit.x + 1, moving: true }, players[1]],
    1,
  );
  assert.ok(startled.nervous > 0);
  assert.equal(startled.leaf, false);
  assert.ok(startled.x < rabbit.x);
});
