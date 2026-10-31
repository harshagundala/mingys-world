import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { WindMaterial } from "./Landscape";
import { pbrTextures, instanceBarkUV } from "./materials";
import { rand } from "./content";
import {
  expeditionControls,
  waterReceivers,
  lightReceivers,
  carryWaypoints,
  heartStart,
  conservatory,
  lookout,
} from "./expeditionContent";

type Point = { x: number; z: number };
const path = (...p: Point[]) =>
  p.slice(1).map((v, i) => [p[i].x, p[i].z, v.x, v.z]);
export const hollowTrails = [
  ...path({ x: 0, z: 54 }, { x: 0, z: 27 }, heartStart),
  ...path({ x: 0, z: 27 }, expeditionControls.water, ...waterReceivers),
  ...path({ x: 0, z: 27 }, expeditionControls.light, ...lightReceivers),
  ...path(heartStart, ...carryWaypoints, { x: 0, z: -62 }),
  ...path(expeditionControls.light, lookout),
];
function distanceToTrail(x: number, z: number, line: number[]) {
  const [ax, az, bx, bz] = line,
    dx = bx - ax,
    dz = bz - az;
  const t = T.MathUtils.clamp(
    ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz),
    0,
    1,
  );
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
function groundHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  return (
    Math.max(0, r - 75) * 0.1 +
    T.MathUtils.smoothstep(r, 79, 118) *
      (7 + Math.sin(x * 0.047 + z * 0.019) * 5 + Math.cos(z * 0.065) * 3)
  );
}
const clearings = [
  heartStart,
  conservatory,
  ...Object.values(expeditionControls),
  ...waterReceivers,
  ...lightReceivers,
  lookout,
];
function safeScenery(x: number, z: number, padding = 0) {
  return (
    !(Math.abs(x) < 16 + padding && z < -32 && z > -67) &&
    clearings.every((p) => Math.hypot(p.x - x, p.z - z) > 6 + padding) &&
    hollowTrails.every((line) => distanceToTrail(x, z, line) > 3.6 + padding)
  );
}

const HollowGround = memo(function HollowGround() {
  const geometry = useMemo(() => {
    const g = new T.PlaneGeometry(280, 280, 96, 96);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i);
      p.setY(i, groundHeight(x, z) - 0.035);
      uv.setXY(i, x / 1.8, -z / 1.8);
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, []);
  const material = useMemo(() => {
    const dirt = pbrTextures("ground"),
      trail = pbrTextures("path");
    const m = new T.MeshStandardMaterial({
      ...dirt,
      color: "#d0d0b5",
      roughness: 0.96,
      normalScale: new T.Vector2(0.5, 0.5),
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.hollowPaths = {
        value: hollowTrails.map(
          (p) => new T.Vector4(...(p as [number, number, number, number])),
        ),
      };
      shader.uniforms.trailMap = { value: trail.map };
      shader.uniforms.trailNormal = { value: trail.normalMap };
      shader.uniforms.trailRough = { value: trail.roughnessMap };
      shader.vertexShader = "varying vec3 hollowWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nhollowWorld=(modelMatrix*vec4(transformed,1.)).xyz;",
      );
      shader.fragmentShader =
        `varying vec3 hollowWorld; uniform vec4 hollowPaths[${hollowTrails.length}]; uniform sampler2D trailMap; uniform sampler2D trailNormal; uniform sampler2D trailRough;
        float hollowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float hollowNoise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hollowHash(a),hollowHash(a+vec2(1.,0.)),f.x),mix(hollowHash(a+vec2(0.,1.)),hollowHash(a+1.),f.x),f.y);}
        ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        vec2 p=hollowWorld.xz; float nearest=10000.;
        for(int i=0;i<${hollowTrails.length};i++){vec4 l=hollowPaths[i];vec2 d=l.zw-l.xy;float t=clamp(dot(p-l.xy,d)/dot(d,d),0.,1.);nearest=min(nearest,length(p-l.xy-t*d));}
        float edge=1.8+hollowNoise(p*.7)*.55; float trailBlend=1.-smoothstep(edge-.5,edge+.5,nearest);
        vec2 dirtUv=vec2(p.x,-p.y)/1.8, trailUv=vec2(p.x,-p.y)/2.1;
        vec3 dirtColor=texture2D(map,dirtUv).rgb, trailColor=texture2D(trailMap,trailUv).rgb;
        float damp=.88+.12*hollowNoise(p*.24); diffuseColor.rgb*=mix(dirtColor,trailColor,trailBlend)*damp;
      `,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "float roughnessFactor=max(.74,roughness*mix(texture2D(roughnessMap,dirtUv).g,texture2D(trailRough,trailUv).g,trailBlend));",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        vec3 mapN=mix(texture2D(normalMap,dirtUv).xyz,texture2D(trailNormal,trailUv).xyz,trailBlend)*2.-1.; mapN.xy*=normalScale; normal=normalize(tbn*mapN);
      `,
      );
    };
    m.customProgramCacheKey = () => "hollow-ground-paths-v1";
    return m;
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} receiveShadow />;
});

/** Trees, ground plants and rocks use seven instanced draws, independent of player updates. */
const HollowGrove = memo(function HollowGrove() {
  const trunks = useRef<T.InstancedMesh>(null),
    branches = useRef<T.InstancedMesh>(null),
    leaves = useRef<T.InstancedMesh>(null),
    grass = useRef<T.InstancedMesh>(null),
    ferns = useRef<T.InstancedMesh>(null),
    stones = useRef<T.InstancedMesh>(null),
    logs = useRef<T.InstancedMesh>(null);
  const maps = useMemo(() => {
    const loader = new T.TextureLoader();
    const leaf = loader.load("/textures/autumn-leaf-cluster.webp"),
      fern = loader.load("/textures/woodland-fern.webp");
    leaf.colorSpace = fern.colorSpace = T.SRGBColorSpace;
    leaf.anisotropy = fern.anisotropy = 4;
    return { leaf, fern };
  }, []);
  useEffect(
    () => () => {
      maps.leaf.dispose();
      maps.fern.dispose();
    },
    [maps],
  );
  const trees = useMemo(() => {
    const result: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 155; i++) {
      const a = i * 2.39996,
        r = 74 + rand(i + 1240) * 42;
      result.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s: 1.1 + rand(i + 2220) * 1.25,
      });
    }
    for (let i = 0; i < 180 && result.length < 198; i++) {
      const x = -70 + rand(i + 4560) * 140,
        z = -68 + rand(i + 6760) * 131;
      if (
        safeScenery(x, z, 3) &&
        result.every((t) => Math.hypot(x - t.x, z - t.z) > 6)
      )
        result.push({ x, z, s: 0.85 + rand(i + 760) * 0.8 });
    }
    return result;
  }, []);
  useLayoutEffect(() => {
    if (
      !trunks.current ||
      !branches.current ||
      !leaves.current ||
      !grass.current ||
      !ferns.current ||
      !stones.current ||
      !logs.current
    )
      return;
    const o = new T.Object3D(),
      c = new T.Color();
    const place = (
      mesh: T.InstancedMesh,
      i: number,
      p: number[],
      s: number[],
      r: number[] = [0, 0, 0],
    ) => {
      o.position.fromArray(p);
      o.scale.fromArray(s);
      o.rotation.set(...(r as [number, number, number]));
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    };
    trees.forEach((tree, i) => {
      const y = groundHeight(tree.x, tree.z),
        s = tree.s;
      place(
        trunks.current!,
        i,
        [tree.x, y + 3 * s, tree.z],
        [0.3 * s, 6 * s, 0.3 * s],
        [0.02, rand(i) * 6.28, -0.03],
      );
      for (let j = 0; j < 3; j++) {
        const a = j * 2.399 + rand(i) * 6.28;
        place(
          branches.current!,
          i * 3 + j,
          [
            tree.x + Math.cos(a) * 0.65 * s,
            y + 4.5 * s,
            tree.z + Math.sin(a) * 0.65 * s,
          ],
          [0.11 * s, 3.1 * s, 0.11 * s],
          [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6],
        );
      }
      for (let j = 0; j < 96; j++) {
        const n = i * 96 + j,
          a = j * 2.399 + rand(i),
          r = Math.sqrt(rand(n + 33)) * 3.2;
        place(
          leaves.current!,
          n,
          [
            tree.x + Math.cos(a) * r * s,
            y + (5.2 + rand(n + 10) * 2.8) * s,
            tree.z + Math.sin(a) * r * s,
          ],
          [s * (1.25 + rand(n)), s * (1.2 + rand(n + 1)), 1],
          [rand(n) * 6.28, rand(n + 9) * 6.28, rand(n + 35) * 6.28],
        );
        leaves.current!.setColorAt(
          n,
          c
            .set(["#e9d6aa", "#e7d0a7", "#e3c29a", "#d6cfb3"][i % 4])
            .multiplyScalar(0.84 + rand(n) * 0.16),
        );
      }
    });
    let gi = 0,
      fi = 0,
      si = 0;
    for (let i = 0; i < 36000 && gi < 8000; i++) {
      const x = -83 + rand(i + 6900) * 166,
        z = -80 + rand(i + 8200) * 159;
      if (!safeScenery(x, z)) continue;
      place(
        grass.current,
        gi,
        [x, groundHeight(x, z) + 0.2, z],
        [0.4 + rand(i) * 0.3, 0.48 + rand(i + 1) * 0.4, 0.4],
        [0, rand(i + 2) * 6.28, 0],
      );
      grass.current.setColorAt(gi++, c.set(i % 3 ? "#66764d" : "#9b8d61"));
      if (fi < 500 && i % 7 === 0) {
        place(
          ferns.current,
          fi++,
          [x, groundHeight(x, z) + 0.5, z],
          [1.2 + rand(i), 1 + rand(i + 4), 1],
          [-0.2, rand(i + 2) * 6.28, 0.05],
        );
      }
      if (si < 420 && i % 4 === 0) {
        place(
          stones.current,
          si,
          [x, groundHeight(x, z) + 0.07, z],
          [
            0.12 + rand(i) * 0.35,
            0.09 + rand(i + 6) * 0.2,
            0.16 + rand(i + 8) * 0.35,
          ],
          [rand(i + 5), rand(i + 9) * 6.28, 0],
        );
        stones.current.setColorAt(si++, c.set(i % 3 ? "#9a9985" : "#6d7e62"));
      }
    }
    grass.current.count = gi;
    ferns.current.count = fi;
    stones.current.count = si;
    let li = 0;
    for (let i = 0; i < 60 && li < 12; i++) {
      const x = -68 + rand(i + 920) * 136,
        z = -65 + rand(i + 922) * 123;
      if (!safeScenery(x, z, 2.5)) continue;
      place(
        logs.current,
        li++,
        [x, 0.25, z],
        [0.3, 2.7 + rand(i) * 2, 0.3],
        [0, rand(i + 3) * 6.28, Math.PI / 2],
      );
    }
    logs.current.count = li;
    [trunks, branches, leaves, grass, ferns, stones, logs].forEach((ref) => {
      const m = ref.current!;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      // The shader moves leaves and grass slightly beyond their static card bounds.
      if (m.boundingSphere) m.boundingSphere.radius += 2;
    });
  }, [trees]);
  const grassGeometry = useMemo(() => {
    const pos: number[] = [],
      uv: number[] = [];
    for (let j = 0; j < 4; j++) {
      const a = j * 2.399,
        dx = Math.cos(a),
        dz = Math.sin(a),
        h = 0.7 + rand(j + 91) * 0.3;
      const root = new T.Vector3(dx * 0.2, -0.5, dz * 0.2),
        middle = root.clone().add(new T.Vector3(dx * 0.12, h * 0.6, dz * 0.12)),
        tip = root.clone().add(new T.Vector3(dx * 0.3, h, dz * 0.3)),
        side = new T.Vector3(-dz * 0.045, 0, dx * 0.045);
      const l = root.clone().sub(side),
        r = root.clone().add(side),
        ml = middle.clone().addScaledVector(side, -0.5),
        mr = middle.clone().addScaledVector(side, 0.5);
      for (const v of [l, r, ml, r, mr, ml, ml, mr, tip])
        pos.push(v.x, v.y, v.z);
      uv.push(0, 0, 1, 0, 0, 0.6, 1, 0, 1, 0.6, 0, 0.6, 0, 0.6, 1, 0.6, 0.5, 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => grassGeometry.dispose(), [grassGeometry]);
  return (
    <>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, trees.length]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.65, 1, 1, 12]} />
        <meshStandardMaterial
          {...pbrTextures("bark")}
          color="#b2b3a4"
          roughness={0.96}
          onBeforeCompile={instanceBarkUV}
        />
      </instancedMesh>
      <instancedMesh
        ref={branches}
        args={[undefined, undefined, trees.length * 3]}
        castShadow
      >
        <cylinderGeometry args={[0.35, 1, 1, 10]} />
        <meshStandardMaterial
          {...pbrTextures("bark")}
          color="#b8b3a2"
          roughness={0.96}
          onBeforeCompile={instanceBarkUV}
        />
      </instancedMesh>
      <instancedMesh
        ref={leaves}
        args={[undefined, undefined, trees.length * 96]}
        castShadow
      >
        <planeGeometry args={[1, 1]} />
        <WindMaterial map={maps.leaf} phase={7} />
      </instancedMesh>
      <instancedMesh
        ref={grass}
        args={[grassGeometry, undefined, 8000]}
        receiveShadow
      >
        <WindMaterial grass phase={5} />
      </instancedMesh>
      <instancedMesh ref={ferns} args={[undefined, undefined, 500]}>
        <planeGeometry args={[1, 1]} />
        <WindMaterial map={maps.fern} phase={2} />
      </instancedMesh>
      <instancedMesh
        ref={stones}
        args={[undefined, undefined, 420]}
        receiveShadow
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial {...pbrTextures("stone")} roughness={0.95} />
      </instancedMesh>
      <instancedMesh
        ref={logs}
        args={[undefined, undefined, 12]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.8, 1, 1, 12]} />
        <meshStandardMaterial
          {...pbrTextures("bark")}
          color="#a7a993"
          onBeforeCompile={instanceBarkUV}
          roughness={0.98}
        />
      </instancedMesh>
    </>
  );
});

export default memo(function ExpeditionLandscape() {
  return (
    <group name="bellweather-landscape">
      <HollowGround />
      <HollowGrove />
    </group>
  );
});
