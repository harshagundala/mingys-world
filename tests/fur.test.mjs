import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { addFur } from "../src/game/Fur.ts";

function puppyPart(geometry = new THREE.SphereGeometry(1, 24, 16)) {
  const parent = new THREE.Group();
  parent.name = "Head";
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.scale.set(0.3, 0.15, 0.2);
  mesh.position.set(0.1, 0.7, 0.2);
  parent.add(mesh);
  const coat = addFur(mesh);
  const strands = parent.children.find((o) =>
    o.geometry?.getAttribute("furRoot"),
  );
  parent.updateWorldMatrix(true, true);
  return { parent, mesh, coat, strands };
}

test("follicles follow the actual scaled sculpt rather than its unit sphere", () => {
  const { mesh, coat, strands } = puppyPart();
  const roots = strands.geometry.getAttribute("furRoot");
  const normals = strands.geometry.getAttribute("furNormal");
  const flow = strands.geometry.getAttribute("furFlow");
  const p = new THREE.Vector3(),
    n = new THREE.Vector3(),
    g = new THREE.Vector3();
  for (let i = 0; i < roots.count; i++) {
    p.fromBufferAttribute(roots, i).sub(mesh.position).divide(mesh.scale);
    assert.ok(p.length() > 0.97 && p.length() < 1.001);
    n.fromBufferAttribute(normals, i);
    g.fromBufferAttribute(flow, i);
    assert.ok(Math.abs(n.length() - 1) < 1e-5);
    assert.ok(Math.abs(n.dot(g)) < 1e-5);
  }
  coat.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("two puppies can use independent detail levels and release their own fur", () => {
  const a = puppyPart();
  const b = puppyPart(a.mesh.geometry);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1, 2);
  a.coat.update(1 / 60, camera);
  camera.position.set(0, 1, 40);
  b.coat.update(1 / 60, camera);
  assert.ok(
    a.strands.geometry.instanceCount > b.strands.geometry.instanceCount * 4,
  );
  assert.deepEqual(
    a.strands.geometry.attributes.furRoot.array,
    b.strands.geometry.attributes.furRoot.array,
  );
  const bCount = b.strands.geometry.instanceCount;
  a.coat.dispose();
  assert.equal(b.strands.parent, b.parent);
  assert.equal(b.strands.geometry.instanceCount, bCount);
  b.coat.dispose();
  a.mesh.geometry.dispose();
  a.mesh.material.dispose();
  b.mesh.material.dispose();
});

test("inertial fur stays bounded through movement, teleports and a suspended tab", () => {
  const { parent, mesh, coat, strands } = puppyPart();
  const shader = { uniforms: {}, vertexShader: "", fragmentShader: "" };
  strands.material.onBeforeCompile(shader, undefined);
  const bend = shader.uniforms.furBend.value;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1, 4);
  let maximum = 0;
  for (let i = 0; i < 600; i++) {
    parent.position.x = i < 120 ? i * 0.045 : i < 240 ? 5.4 : 100;
    parent.updateWorldMatrix(true, true);
    coat.update(i === 400 ? 8 : 1 / 60, camera);
    assert.ok(bend.toArray().every(Number.isFinite));
    maximum = Math.max(maximum, bend.length());
  }
  assert.ok(maximum > 0.03, "motion should bend the tips");
  assert.ok(maximum < 0.6, "the spring must not explode");
  assert.ok(bend.length() < 0.001, "the coat settles after stopping");
  coat.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("strand pigment follows painted coat colors and remains neutral on unpainted meshes", () => {
  const plain = puppyPart();
  const neutral = plain.strands.geometry.getAttribute("furPigment");
  assert.ok(neutral.array.every((v) => v === 1));
  plain.coat.dispose();
  plain.mesh.geometry.dispose();
  plain.mesh.material.dispose();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3),
  );
  geometry.computeVertexNormals();
  const { mesh, coat, strands } = puppyPart(geometry);
  const roots = strands.geometry.getAttribute("furRoot");
  const pigments = strands.geometry.getAttribute("furPigment");
  const p = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < roots.count; i++) {
    p.fromBufferAttribute(roots, i).sub(mesh.position).divide(mesh.scale);
    c.fromBufferAttribute(pigments, i);
    assert.ok(c.distanceTo(new THREE.Vector3(1 - p.x - p.y, p.x, p.y)) < 1e-5);
  }
  coat.dispose();
  geometry.dispose();
  mesh.material.dispose();
});
