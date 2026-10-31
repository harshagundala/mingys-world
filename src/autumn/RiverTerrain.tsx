import { useEffect, useMemo } from "react";
import * as T from "three";
import { riverStops } from "./content";
import { pbrTextures } from "./materials";

function shore(z: number) {
  return 17.35 + Math.sin(z * 0.027) * 0.55 + Math.sin(z * 0.091) * 0.24;
}
/** One shared height function grounds the river's trees on the same rolling banks. */
export function riverGroundHeight(x: number, z: number) {
  const d = Math.max(0, Math.abs(x) - shore(z));
  const slope = T.MathUtils.smoothstep(d, 4, 32);
  let y =
    0.08 +
    d * 0.035 +
    slope *
      (4.5 +
        Math.sin(z * 0.024 + Math.abs(x) * 0.07) * 2.4 +
        Math.cos(z * 0.057) * 1.5);
  // Landings remain gently level beneath their real deck/building footprints.
  if (x > 0)
    for (const stop of riverStops) {
      const landing =
        1 -
        T.MathUtils.smoothstep(Math.hypot((x - 22) * 0.8, z + stop + 8), 8, 15);
      y *= 1 - landing * 0.97;
    }
  return y;
}

/** Two continuous banks; the river stays open and the distant silhouette has depth. */
export function RiverTerrain() {
  const geometry = useMemo(() => {
    const list: T.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const nx = 26,
        nz = 190,
        positions: number[] = [],
        uv: number[] = [],
        indices: number[] = [];
      for (let iz = 0; iz <= nz; iz++) {
        const z = 90 - iz * 6;
        for (let ix = 0; ix <= nx; ix++) {
          const x = side * (shore(z) + ix * 4.7);
          positions.push(x, ix === 0 ? -0.16 : riverGroundHeight(x, z), z);
          uv.push(x / 1.8, -z / 1.8);
        }
      }
      for (let iz = 0; iz < nz; iz++)
        for (let ix = 0; ix < nx; ix++) {
          const a = iz * (nx + 1) + ix,
            b = a + 1,
            c = a + nx + 1,
            d = c + 1;
          if (side > 0) indices.push(a, b, c, b, d, c);
          else indices.push(a, c, b, b, c, d);
        }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(indices);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      list.push(g);
    }
    return list;
  }, []);
  useEffect(() => () => geometry.forEach((g) => g.dispose()), [geometry]);
  return (
    <group name="sculpted-riverbanks">
      {geometry.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial
            {...pbrTextures("ground")}
            color="#d8d6c6"
            roughness={0.98}
            normalScale={new T.Vector2(0.5, 0.5)}
          />
        </mesh>
      ))}
    </group>
  );
}
