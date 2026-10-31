import test from "node:test";
import assert from "node:assert/strict";
import { input, trackpadLook } from "../src/autumn/controls.ts";

const pan = (overrides = {}) => {
  const event = {
    deltaX: 20,
    deltaY: -10,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...overrides,
  };
  trackpadLook(event);
  return event;
};
const reset = () =>
  Object.assign(input, { yaw: 0, pitch: 0, blocked: false, sensitivity: 1 });

test("two-finger look works without pointer lock or a mouse button", () => {
  reset();
  input.look = false;
  assert.equal(pan().prevented, true);
  assert.equal(input.yaw, -0.06);
  assert.equal(input.pitch, 0.03);
  input.sensitivity = 0.5;
  pan();
  assert.equal(input.yaw, -0.09);
});
test("menus and browser pinch/modifier gestures do not turn the player", () => {
  reset();
  input.blocked = true;
  assert.equal(pan().prevented, false);
  input.blocked = false;
  for (const modifier of ["ctrlKey", "metaKey", "altKey"])
    assert.equal(pan({ [modifier]: true }).prevented, false);
  assert.equal(input.yaw, 0);
  assert.equal(input.pitch, 0);
});
test("line-mode scrolling is normalized and large deltas cannot flip the view", () => {
  reset();
  pan({ deltaMode: 1, deltaX: 1, deltaY: 0 });
  assert.equal(input.yaw, -0.048);
  pan({ deltaX: 1000000, deltaY: -1000000 });
  assert.ok(Math.abs(input.yaw + 0.408) < 1e-9);
  for (let i = 0; i < 20; i++) pan({ deltaX: 0, deltaY: -120 });
  assert.equal(input.pitch, 1.15);
  pan({ deltaX: NaN, deltaY: Infinity });
  assert.ok(Number.isFinite(input.yaw));
  assert.equal(input.pitch, 1.15);
});
