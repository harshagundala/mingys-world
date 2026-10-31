import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { indexGeometry } from "../src/autumn/indexGeometry.ts";

test("rounded scenery keeps every vertex attribute and triangle with smaller GPU buffers", () => {
  const source = new RoundedBoxGeometry(3, 2, 1, 2, 0.025);
  const compact = indexGeometry(source);
  assert.equal(source.index, null);
  assert.equal(source.attributes.position.count, 900);
  assert.equal(compact.index.count, 900);
  assert.ok(compact.attributes.position.count < 240);
  const expanded = compact.toNonIndexed();
  for (const [name, attribute] of Object.entries(source.attributes))
    assert.deepEqual(expanded.getAttribute(name).array, attribute.array, name);
  source.computeBoundingSphere();
  compact.computeBoundingSphere();
  assert.deepEqual(compact.boundingSphere, source.boundingSphere);
  assert.deepEqual(compact.groups, source.groups);
});

test("coincident vertices with different UVs or normals stay separate", () => {
  const source = new T.BufferGeometry();
  source.setAttribute(
    "position",
    new T.Float32BufferAttribute(Array(12).fill(0), 3),
  );
  source.setAttribute(
    "uv",
    new T.Float32BufferAttribute([0, 0, 1, 0, 0, 0, 0, 0], 2),
  );
  source.setAttribute(
    "normal",
    new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 1, 0], 3),
  );
  const compact = indexGeometry(source);
  assert.equal(compact.attributes.position.count, 3);
  assert.deepEqual(Array.from(compact.index.array), [0, 1, 2, 0]);
});

test("already indexed geometry stays indexed and owns its cloned buffers", () => {
  const source = new T.SphereGeometry(1, 20, 14);
  const compact = indexGeometry(source);
  assert.equal(
    compact.attributes.position.count,
    source.attributes.position.count,
  );
  assert.deepEqual(compact.index.array, source.index.array);
  assert.notEqual(compact.index.array, source.index.array);
  compact.translate(10, 0, 0);
  assert.notDeepEqual(
    compact.attributes.position.array,
    source.attributes.position.array,
  );
});
