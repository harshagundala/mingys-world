import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { lanternStands, props, rand, towers } from "./content";
import type { Pose } from "./content";
import type { State } from "../../server/autumn/rules";
import { net } from "./network";

const lightColors = [
  "#ffbd68",
  "#9ce0cc",
  "#e9a7c8",
  "#a9b9ed",
  "#e6d58f",
  "#e89b78",
];
const MAX_PARTICLES = 64;

function canvasMap(kind: "earth" | "dust" | "leaf" | "light") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  if (kind === "leaf") {
    ctx.fillStyle = "#d6b177";
    ctx.beginPath();
    ctx.moveTo(63, 116);
    for (const [x, y] of [
      [40, 90],
      [16, 91],
      [30, 70],
      [9, 40],
      [43, 47],
      [41, 15],
      [63, 32],
      [73, 8],
      [83, 43],
      [118, 32],
      [102, 68],
      [117, 85],
      [85, 91],
    ])
      ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#735e3d99";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(63, 116);
    ctx.lineTo(68, 30);
    ctx.moveTo(64, 84);
    ctx.lineTo(26, 50);
    ctx.moveTo(65, 75);
    ctx.lineTo(103, 48);
    ctx.stroke();
  } else {
    const image = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 4,
          r = Math.hypot((x - 64) / 64, (y - 64) / 64);
        const n = rand(x * 0.75 + y * 131.7),
          fine = rand(x + y * 128);
        const edge =
          kind === "earth"
            ? Math.max(0, 1 - r * (0.93 + n * 0.22))
            : Math.max(0, 1 - r);
        const alpha = Math.pow(
          edge,
          kind === "light" ? 3.2 : kind === "dust" ? 2.2 : 1.3,
        );
        const tone = kind === "earth" ? 110 + fine * 50 : 235 + fine * 20;
        image.data[i] = tone;
        image.data[i + 1] = tone;
        image.data[i + 2] = tone;
        image.data[i + 3] = Math.round(
          255 * alpha * (kind === "earth" ? 0.36 + fine * 0.64 : 0.8 + n * 0.2),
        );
      }
    ctx.putImageData(image, 0, 0);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

/** The cleared patch remains in both worlds and is reconstructed from the save on refresh. */
function HarvestTraces({ s }: { s: State }) {
  const soil = useRef<T.InstancedMesh>(null),
    stems = useRef<T.InstancedMesh>(null);
  const earth = useMemo(() => canvasMap("earth"), []);
  useEffect(() => () => earth.dispose(), [earth]);
  useEffect(() => {
    if (!soil.current || !stems.current) return;
    const collected = new Set(s.collected),
      o = new T.Object3D(),
      color = new T.Color();
    let patches = 0,
      twigs = 0;
    for (const p of props) {
      if (!collected.has(p.id)) continue;
      const radius =
        p.kind === "wood"
          ? 0.58
          : p.kind === "pumpkin"
            ? 0.48
            : p.kind === "mushroom"
              ? 0.22
              : 0.24;
      o.position.set(p.x, 0.017, p.z);
      o.rotation.set(-Math.PI / 2, 0, rand(p.x + p.z) * 6.28);
      o.scale.set(radius * 2, radius * 1.5, 1);
      o.updateMatrix();
      soil.current.setMatrixAt(patches++, o.matrix);
      const count =
        p.kind === "wood"
          ? 4
          : p.kind === "mushroom"
            ? 3
            : p.kind === "pumpkin"
              ? 1
              : 0;
      for (let j = 0; j < count; j++) {
        const seed = p.x * 31 + p.z * 17 + j;
        o.position.set(
          p.x + (rand(seed) - 0.5) * radius,
          0.036,
          p.z + (rand(seed + 1) - 0.5) * radius,
        );
        if (p.kind === "wood") {
          o.scale.set(0.016, 0.13 + rand(seed + 3) * 0.2, 0.014);
          o.rotation.set(Math.PI / 2 + 0.08, rand(seed + 5) * 6.28, 0.12);
          color.set("#a68b63");
        } else {
          const pumpkin = p.kind === "pumpkin";
          o.scale.set(
            pumpkin ? 0.052 : 0.023,
            pumpkin ? 0.105 : 0.05,
            pumpkin ? 0.044 : 0.024,
          );
          o.rotation.set(0.14, rand(seed + 2) * 6.28, 0.09);
          o.position.y = pumpkin ? 0.062 : 0.032;
          color.set(pumpkin ? "#667043" : "#d3c3a3");
        }
        o.updateMatrix();
        stems.current.setMatrixAt(twigs, o.matrix);
        stems.current.setColorAt(twigs++, color);
      }
    }
    soil.current.count = patches;
    stems.current.count = twigs;
    soil.current.instanceMatrix.needsUpdate = true;
    stems.current.instanceMatrix.needsUpdate = true;
    if (stems.current.instanceColor)
      stems.current.instanceColor.needsUpdate = true;
    soil.current.computeBoundingSphere();
    stems.current.computeBoundingSphere();
  }, [s.collected]);
  return (
    <group name="harvest-ground-memory">
      <instancedMesh
        ref={soil}
        args={[undefined, undefined, props.length]}
        renderOrder={1}
        receiveShadow
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={earth}
          color="#685337"
          transparent
          opacity={0.48}
          roughness={1}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </instancedMesh>
      <instancedMesh
        ref={stems}
        args={[undefined, undefined, props.length * 4]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.65, 1, 1, 6]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </group>
  );
}

function segmentDistance(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const dx = bx - ax,
    dz = bz - az,
    t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)),
    );
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}
function onTrail(x: number, z: number) {
  return (
    Math.min(
      segmentDistance(x, z, 0, -57, 0, 49),
      segmentDistance(x, z, -33, -18, 0, 24),
      segmentDistance(x, z, 0, 8, 32, -28),
    ) < 2.7
  );
}
type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  rise: number;
  at: number;
  life: number;
  size: number;
  spin: number;
  leaf: boolean;
  seed: number;
};

/** Small, finite debris from actual ground contacts, shared visually through the pose stream. */
function FootfallLitter({ s, quality }: { s: State; quality: string }) {
  const dust = useRef<T.InstancedMesh>(null),
    leaves = useRef<T.InstancedMesh>(null);
  const particles = useRef<Particle[]>(
    Array.from({ length: MAX_PARTICLES }, (_, i) => ({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      rise: 0,
      at: -100,
      life: 1,
      size: 0,
      spin: 0,
      leaf: false,
      seed: i,
    })),
  );
  const cursor = useRef(0),
    steps = useRef([
      { x: 0, z: 0, distance: 0, at: 0, ready: false, side: 1 },
      { x: 0, z: 0, distance: 0, at: 0, ready: false, side: 1 },
    ]);
  const reduced = useRef(false);
  const assets = useMemo(() => {
    const dustMap = canvasMap("dust"),
      leafMap = canvasMap("leaf");
    const dustGeometry = new T.PlaneGeometry(1, 1),
      leafGeometry = new T.PlaneGeometry(1, 1);
    dustGeometry.setAttribute(
      "particleFade",
      new T.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES), 1),
    );
    leafGeometry.setAttribute(
      "particleFade",
      new T.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES), 1),
    );
    const shader = (s: T.WebGLProgramParametersWithUniforms) => {
      s.vertexShader =
        "attribute float particleFade; varying float litterFade;\n" +
        s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nlitterFade=particleFade;",
      );
      s.fragmentShader = "varying float litterFade;\n" + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.a*=litterFade;",
      );
    };
    const dustMaterial = new T.MeshStandardMaterial({
      map: dustMap,
      color: "#c4b18c",
      transparent: true,
      depthWrite: false,
      roughness: 1,
      opacity: 0.2,
      side: T.DoubleSide,
    });
    const leafMaterial = new T.MeshStandardMaterial({
      map: leafMap,
      color: "#b39462",
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      roughness: 1,
      side: T.DoubleSide,
    });
    dustMaterial.onBeforeCompile = shader;
    leafMaterial.onBeforeCompile = shader;
    dustMaterial.customProgramCacheKey = () => "footfall-opacity-v1";
    leafMaterial.customProgramCacheKey = () => "footfall-opacity-v1";
    return {
      dustMap,
      leafMap,
      dustGeometry,
      leafGeometry,
      dustMaterial,
      leafMaterial,
    };
  }, []);
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      reduced.current = q.matches;
    };
    change();
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(
    () => () => {
      Object.values(assets).forEach((a) => a.dispose());
    },
    [assets],
  );
  const scratch = useMemo(
    () => ({ o: new T.Object3D(), c: new T.Color() }),
    [],
  );
  useFrame(({ camera }) => {
    if (!dust.current || !leaves.current) return;
    const now = performance.now() / 1000;
    const emit = (p: Pose, side: number) => {
      const trail = onTrail(p.x, p.z),
        bridge = s.bridge >= 6 && Math.abs(p.x) < 2 && p.z < -56 && p.z > -75;
      const count = quality === "low" ? 1 : trail ? 4 : 2;
      for (let j = 0; j < count; j++) {
        const index = cursor.current++ % MAX_PARTICLES,
          item = particles.current[index],
          seed = index + Math.floor(now * 10);
        const angle = p.yaw + Math.PI + (rand(seed) - 0.5) * 2.4;
        const leaf = bridge ? true : trail ? j === 0 : true;
        item.x = p.x + Math.cos(p.yaw) * side * 0.12;
        item.z = p.z - Math.sin(p.yaw) * side * 0.12;
        item.y = (bridge ? 0.35 : 0) + 0.035;
        item.vx = Math.sin(angle) * (0.13 + rand(seed + 1) * 0.26);
        item.vz = Math.cos(angle) * (0.13 + rand(seed + 1) * 0.26);
        item.rise = leaf ? 0.12 + rand(seed + 5) * 0.2 : 0.1;
        item.at = now;
        item.life = leaf
          ? 1.1 + rand(seed + 2) * 0.7
          : 0.75 + rand(seed + 2) * 0.5;
        item.size = leaf
          ? 0.055 + rand(seed + 3) * 0.045
          : 0.19 + rand(seed + 3) * 0.18;
        item.spin = rand(seed + 4) * 6.28;
        item.leaf = leaf;
        item.seed = seed;
      }
    };
    for (let r = 0; r < 2; r++) {
      const p =
          r === net.snapshot.role
            ? net.local
            : net.snapshot.peer
              ? net.motion.sample(performance.now())
              : undefined,
        tracker = steps.current[r];
      if (!p || p.scene !== "valley" || reduced.current) {
        tracker.ready = false;
        continue;
      }
      if (!tracker.ready) {
        tracker.x = p.x;
        tracker.z = p.z;
        tracker.ready = true;
      }
      const d = Math.hypot(p.x - tracker.x, p.z - tracker.z);
      tracker.x = p.x;
      tracker.z = p.z;
      if (d > 1.5) {
        tracker.distance = 0;
        continue;
      }
      const floor =
        s.bridge >= 6 && Math.abs(p.x) < 2 && p.z < -56 && p.z > -75 ? 0.35 : 0;
      if (p.y > floor + 0.035 || !p.moving) {
        tracker.distance = 0;
        continue;
      }
      tracker.distance += d;
      if (tracker.distance > 0.72 && now - tracker.at > 0.18) {
        tracker.distance = 0;
        tracker.at = now;
        tracker.side *= -1;
        emit(p, tracker.side);
      }
    }
    const dFade = assets.dustGeometry.getAttribute(
        "particleFade",
      ) as T.InstancedBufferAttribute,
      lFade = assets.leafGeometry.getAttribute(
        "particleFade",
      ) as T.InstancedBufferAttribute;
    let nd = 0,
      nl = 0;
    for (const p of particles.current) {
      const t = (now - p.at) / p.life;
      if (t < 0 || t >= 1) continue;
      const o = scratch.o;
      o.position.set(
        p.x + p.vx * t,
        p.y + (p.leaf ? Math.sin(t * Math.PI) * p.rise : t * 0.14),
        p.z + p.vz * t,
      );
      if (p.leaf) {
        o.rotation.set(
          -Math.PI / 2 + Math.sin(t * Math.PI) * 0.9,
          p.spin + t * 2,
          Math.sin(t * 5 + p.spin) * 0.2,
        );
        o.scale.setScalar(p.size);
      } else {
        o.quaternion.copy(camera.quaternion);
        o.scale.setScalar(p.size * (0.7 + t * 1.4));
      }
      o.updateMatrix();
      if (p.leaf) {
        leaves.current.setMatrixAt(nl, o.matrix);
        lFade.setX(nl++, Math.min(1, (1 - t) * 3));
      } else {
        dust.current.setMatrixAt(nd, o.matrix);
        dFade.setX(nd++, Math.sin(t * Math.PI) * (1 - t));
      }
    }
    dust.current.count = nd;
    leaves.current.count = nl;
    dust.current.instanceMatrix.needsUpdate = true;
    leaves.current.instanceMatrix.needsUpdate = true;
    dFade.needsUpdate = true;
    lFade.needsUpdate = true;
  });
  return (
    <group name="footfall-litter">
      <instancedMesh
        ref={dust}
        args={[assets.dustGeometry, assets.dustMaterial, MAX_PARTICLES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={leaves}
        args={[assets.leafGeometry, assets.leafMaterial, MAX_PARTICLES]}
        frustumCulled={false}
      />
    </group>
  );
}

/** Bounded ground irradiance: no additional shadow maps or per-lantern point lights. */
function LanternSpill({ s }: { s: State }) {
  const mesh = useRef<T.InstancedMesh>(null);
  const slots = useMemo(
    () => [
      { id: "welcome-0", x: -3, z: 32, r: 2.3 },
      { id: "welcome-1", x: 3, z: 32, r: 2.3 },
      ...towers.map((t, i) => ({ id: `tower-${i}`, x: t.x, z: t.z, r: 3.4 })),
      ...lanternStands.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 2.5 })),
    ],
    [],
  );
  const fade = useRef(slots.map(() => 0)),
    ready = useRef(false),
    texture = useMemo(() => canvasMap("light"), []);
  const o = useMemo(() => new T.Object3D(), []),
    c = useMemo(() => new T.Color(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    const night = s.phase >= 6 ? 1 : 0.22;
    slots.forEach((p, i) => {
      const active =
        i < 2
          ? s.ready.includes(i)
          : i < 8
            ? s.towers.includes(i - 2)
            : !!s.lanterns[p.id] && s.phase === 7;
      const desired = active ? night : 0;
      fade.current[i] = ready.current
        ? T.MathUtils.damp(fade.current[i], desired, 2.5, Math.min(0.05, delta))
        : desired;
      o.position.set(p.x, 0.023, p.z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.scale.set(p.r * 2, p.r * 2, 1);
      o.updateMatrix();
      mesh.current!.setMatrixAt(i, o.matrix);
      c.set(
        i >= 8 && s.lanterns[p.id]
          ? lightColors[s.lanterns[p.id].color]
          : i >= 2 && i < 8
            ? "#a8d9cb"
            : "#edc784",
      );
      c.multiplyScalar(fade.current[i] * 0.4);
      mesh.current!.setColorAt(i, c);
    });
    ready.current = true;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      name="shared-lantern-spill"
      ref={mesh}
      args={[undefined, undefined, slots.length]}
      frustumCulled={false}
      renderOrder={2}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.5}
        blending={T.AdditiveBlending}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        fog
      />
    </instancedMesh>
  );
}

/** Mount once beneath Canvas, alongside the valley. No progression mutations or network messages. */
export function EnvironmentResponse({
  s,
  river = false,
  quality = "high",
}: {
  s: State;
  river?: boolean;
  quality?: string;
}) {
  if (river) return null;
  return (
    <group name="environment-response">
      <HarvestTraces s={s} />
      <FootfallLitter s={s} quality={quality} />
      <LanternSpill s={s} />
    </group>
  );
}
