import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Explicitly static scenery only. Moving/gameplay objects stay outside this group. */
export function StaticGeometry({
  children,
  revision,
}: {
  children: ReactNode;
  revision?: string | number;
}) {
  const root = useRef<T.Group>(null);
  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map<string, T.Mesh[]>();
    group.traverseVisible((object) => {
      const mesh = object as T.Mesh;
      if (
        !mesh.isMesh ||
        (mesh as T.InstancedMesh).isInstancedMesh ||
        (mesh as T.SkinnedMesh).isSkinnedMesh ||
        mesh.children.length ||
        Array.isArray(mesh.material) ||
        mesh.material.transparent ||
        mesh.material.opacity < 1 ||
        Object.keys(mesh.geometry.morphAttributes).length
      )
        return;
      const attributes = Object.entries(mesh.geometry.attributes)
        .map(([key, attr]) => `${key}:${attr.itemSize}:${attr.normalized}`)
        .sort()
        .join(";");
      const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${mesh.layers.mask}:${attributes}`;
      const bucket = buckets.get(key) || [];
      bucket.push(mesh);
      buckets.set(key, bucket);
    });
    const replacements: { mesh: T.Mesh; originals: T.Mesh[] }[] = [];
    for (const originals of buckets.values()) {
      if (originals.length < 2) continue;
      const geometries = originals.map((mesh) => {
        const geometry = mesh.geometry.index
          ? mesh.geometry.toNonIndexed()
          : mesh.geometry.clone();
        geometry.clearGroups();
        geometry.applyMatrix4(
          new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
        );
        return geometry;
      });
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((part) => part.dispose());
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const source = originals[0];
      const mesh = new T.Mesh(geometry, source.material);
      mesh.name = `static-batch-${originals.length}`;
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.renderOrder = source.renderOrder;
      mesh.layers.mask = source.layers.mask;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      originals.forEach((original) => (original.visible = false));
      replacements.push({ mesh, originals });
    }
    return () => {
      for (const { mesh, originals } of replacements) {
        group.remove(mesh);
        mesh.geometry.dispose();
        originals.forEach((original) => (original.visible = true));
      }
    };
  }, [revision]);
  return <group ref={root}>{children}</group>;
}
