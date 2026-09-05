import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
/** Bake static scenery into material batches; physics bodies remain independent. */
export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const group = root.current!;
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map<
      string,
      {
        material: THREE.Material;
        geometries: THREE.BufferGeometry[];
        cast: boolean;
        receive: boolean;
      }
    >();
    const originals: THREE.Mesh[] = [];
    group.traverse((object) => {
      const m = object as THREE.Mesh;
      if (
        !m.isMesh ||
        !m.visible ||
        Array.isArray(m.material) ||
        (m as THREE.SkinnedMesh).isSkinnedMesh
      )
        return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.transparent || mat.type === "ShaderMaterial") return;
      const key = [
        mat.type,
        mat.color?.getHex(),
        mat.emissive?.getHex(),
        mat.emissiveIntensity,
        mat.roughness,
        mat.metalness,
        mat.map?.uuid,
        mat.bumpMap?.uuid,
        mat.bumpScale,
        mat.normalMap?.uuid,
        mat.roughnessMap?.uuid,
        mat.side,
        m.castShadow,
        m.receiveShadow,
      ].join(":");
      if (!batches.has(key))
        batches.set(key, {
          material: mat,
          geometries: [],
          cast: m.castShadow,
          receive: m.receiveShadow,
        });
      const g = m.geometry.index
        ? m.geometry.toNonIndexed()
        : m.geometry.clone();
      // Static primitives share position, normal and UV. Extra attributes are not used here.
      for (const attr of Object.keys(g.attributes))
        if (!["position", "normal", "uv"].includes(attr))
          g.deleteAttribute(attr);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv)
        g.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            new Float32Array(g.attributes.position.count * 2),
            2,
          ),
        );
      g.applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld),
      );
      batches.get(key)!.geometries.push(g);
      originals.push(m);
    });
    const merged: THREE.Mesh[] = [];
    for (const b of batches.values()) {
      const geometry = mergeGeometries(b.geometries, false);
      b.geometries.forEach((g) => g.dispose());
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.name = "Static scenery batch";
      group.add(mesh);
      merged.push(mesh);
    }
    originals.forEach((m) => (m.visible = false));
    return () => {
      originals.forEach((m) => (m.visible = true));
      merged.forEach((m) => {
        group.remove(m);
        m.geometry.dispose();
      });
    };
  }, []);
  return <group ref={root}>{children}</group>;
}
