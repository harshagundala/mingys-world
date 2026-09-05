import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

test("exported retriever retains its animation rig, painted coat, eyelids and gameplay scale", async () => {
  const bytes = fs.readFileSync(
    new URL("../public/models/puppy-v4.glb", import.meta.url),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  for (const name of [
    "Head",
    "EarL",
    "EarR",
    "FrontL",
    "FrontR",
    "BackL",
    "BackR",
    "Tail",
    "Jaw",
    "BowAnchor",
  ]) {
    assert.ok(scene.getObjectByName(name), `missing attachment: ${name}`);
  }
  const bounds = new THREE.Box3().setFromObject(scene),
    size = bounds.getSize(new THREE.Vector3());
  assert.ok(
    bounds.min.y >= 0 && bounds.min.y < 0.08,
    "paws remain at the existing floor height",
  );
  assert.ok(
    size.x < 0.8 && size.y > 1.2 && size.y < 1.6 && size.z < 2.4,
    "puppies must fit the existing world and overhead video clearance",
  );
  let painted = 0,
    lids = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name.startsWith("Fur")) {
      const colors = o.geometry.getAttribute("color");
      assert.ok(
        colors && o.material.vertexColors,
        `${o.name} lost coat pigment during export`,
      );
      assert.ok(
        colors.array.some((v) => v > 0 && v < 0.9),
        "coat must contain actual pigment rather than the exporter white fallback",
      );
      painted++;
    }
    if (o.morphTargetDictionary?.Blink !== undefined) {
      assert.ok(o.geometry.morphAttributes.position.length > 0);
      lids++;
    }
  });
  assert.equal(painted, 10);
  assert.equal(
    lids,
    8,
    "both upper and lower lid surfaces and margins must animate on both eyes",
  );
});
