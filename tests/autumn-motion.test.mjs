import test from "node:test";
import assert from "node:assert/strict";
import { MotionBuffer, angleDelta } from "../src/autumn/motion.ts";
import { spawn } from "../src/autumn/content.ts";
const pose = (seq, x, extra = {}) => ({
  ...spawn(1),
  x,
  seq,
  moving: true,
  ...extra,
});
test("motion interpolates uneven arrivals without stepping backward on duplicate or delayed packets", () => {
  const b = new MotionBuffer();
  b.push(pose(1, 0), 0);
  b.push(pose(2, 0.4), 80);
  b.push(pose(3, 0.7), 140);
  assert.equal(b.push(pose(2, -20), 145), false);
  assert.ok(Math.abs(b.sample(210).x - 0.55) < 1e-8);
  assert.equal(b.frames.length, 3);
});
test("short gaps extrapolate at bounded speed then settle instead of drifting indefinitely", () => {
  const b = new MotionBuffer();
  b.push(pose(1, 0), 0);
  b.push(pose(2, 1), 50);
  assert.equal(b.sample(1000).moving, false);
  assert.ok(b.sample(1000).x <= 1.96);
  assert.equal(b.sample(2000).x, b.sample(1000).x);
});
test("heading interpolation uses the short arc at the 360 degree boundary", () => {
  const b = new MotionBuffer();
  b.push(pose(1, 0, { yaw: Math.PI - 0.1 }), 0);
  b.push(pose(2, 1, { yaw: -Math.PI + 0.1 }), 100);
  assert.ok(Math.abs(b.sample(150).yaw - Math.PI) < 1e-8);
  assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-8);
});
test("scene changes and real relocations reset the interpolation history", () => {
  const b = new MotionBuffer();
  b.push(pose(30, 0), 0);
  b.push(pose(31, 20), 50);
  assert.equal(b.frames.length, 1);
  b.push(pose(1, 0, { scene: "river" }), 100);
  assert.equal(b.frames.length, 1);
  assert.equal(b.sample(100).scene, "river");
  b.clear();
  assert.equal(b.sample(500), undefined);
});
test("packet loss does not extrapolate vertical position past a jump landing", () => {
  const b = new MotionBuffer();
  b.push(pose(1, 0, { y: 0.8 }), 0);
  b.push(pose(2, 0.2, { y: 0 }), 60);
  assert.equal(b.sample(400).y, 0);
});
