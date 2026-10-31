import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WindMaterial } from "./Landscape";
import { riverGroundHeight } from "./RiverTerrain";
import { pbrTextures, instanceBarkUV } from "./materials";
import { StaticGeometry } from "./StaticGeometry";
import { indexGeometry } from "./indexGeometry";
import { rand, colors } from "./content";
import type { Role } from "./content";
export const mat = {
  wood: "#674332",
  woodLight: "#aa784b",
  roof: "#424e50",
  stone: "#89918a",
  cream: "#d9c8a4",
  iron: "#303c3c",
  gold: "#e8ac55",
};
export type BoxSurface =
  "wood" | "plaster" | "stone" | "metal" | "roof" | "ground";
const boxGeometries = new Map<string, T.BufferGeometry>();
function boxGeometry(size: number[]) {
  const key = size.join(",");
  let g = boxGeometries.get(key);
  if (g) return g;
  g = new RoundedBoxGeometry(
    size[0],
    size[1],
    size[2],
    2,
    Math.min(0.025, Math.min(...size) * 0.13),
  );
  const p = g.attributes.position,
    n = g.attributes.normal,
    uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(n.getX(i)),
      y = Math.abs(n.getY(i)),
      z = Math.abs(n.getZ(i));
    // Grain follows the longer face dimension: upright posts stay upright,
    // while beams and planks run along their length.
    const axes = y > x && y > z ? [0, 2] : x > z ? [2, 1] : [0, 1];
    if (size[axes[0]] < size[axes[1]]) axes.reverse();
    const values = [p.getX(i), p.getY(i), p.getZ(i)];
    uv.setXY(i, values[axes[0]] * 0.65, values[axes[1]] * 0.65);
  }
  uv.needsUpdate = true;
  const compact = indexGeometry(g);
  g.dispose();
  g = compact;
  boxGeometries.set(key, g);
  return g;
}
const boxMaterials = new Map<string, T.MeshStandardMaterial>();
function surface(color: string, glow: number, explicit?: BoxSurface) {
  const key = color + glow + explicit;
  let material = boxMaterials.get(key);
  if (!material) {
    const c = new T.Color(color);
    const metal =
      explicit === "metal" ||
      [mat.iron, mat.gold, "#77817e", "#a5afa4", "#566665"].includes(color);
    const kind =
      explicit ||
      (!metal && c.r > c.b * 1.15 && c.g < c.r * 0.95 ? "wood" : undefined);
    const texture =
      kind === "roof" ? "stone" : kind === "metal" ? undefined : kind;
    const tint = c.clone();
    if (texture)
      tint.lerp(
        new T.Color("#ffffff"),
        kind === "roof" ? 0.05 : kind === "plaster" ? 0.72 : 0.65,
      );
    material = new T.MeshStandardMaterial({
      color: tint,
      ...(texture && !glow ? pbrTextures(texture) : {}),
      normalScale: new T.Vector2(
        kind === "plaster" ? 0.3 : 0.55,
        kind === "plaster" ? 0.3 : 0.55,
      ),
      roughness: metal ? 0.34 : kind === "roof" ? 0.82 : 0.92,
      metalness: metal ? 0.62 : 0,
      emissive: color,
      emissiveIntensity: glow,
    });
    boxMaterials.set(key, material);
  }
  return material;
}
let paperTexture: T.CanvasTexture | null = null;
export function paperMap() {
  if (paperTexture) return paperTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f8edce";
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1600; i++) {
    x.fillStyle = i % 2 ? "#b7a87c18" : "#ffffff22";
    x.fillRect(rand(i) * 128, rand(i + 43) * 128, 1, 3);
  }
  for (let i = 0; i < 8; i++) {
    x.fillStyle = "#7c663c36";
    x.fillRect(0, i * 16, 128, 1);
  }
  paperTexture = new T.CanvasTexture(c);
  paperTexture.colorSpace = T.SRGBColorSpace;
  return paperTexture;
}
export function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  color = mat.wood,
  rot = [0, 0, 0],
  glow = 0,
  material,
}: {
  p?: number[];
  s?: number[];
  color?: string;
  rot?: number[];
  glow?: number;
  material?: BoxSurface;
}) {
  return (
    <mesh
      position={p as any}
      rotation={rot as any}
      geometry={boxGeometry(s)}
      material={surface(color, glow, material)}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
const orbGeometry = new T.SphereGeometry(1, 20, 14);
const orbMaterials = new Map<string, T.MeshStandardMaterial>();
function orbMaterial(color: string, glow: number) {
  const key = `${color}:${glow}`;
  let material = orbMaterials.get(key);
  if (!material) {
    // Skin, fruit and cloth retain their original color; no architectural PBR heuristic.
    material = new T.MeshStandardMaterial({
      color,
      roughness: 0.75,
      emissive: color,
      emissiveIntensity: glow,
    });
    orbMaterials.set(key, material);
  }
  return material;
}
export function Orb({
  p = [0, 0, 0],
  s = [1, 1, 1],
  color = mat.gold,
  glow = 0,
}: {
  p?: number[];
  s?: number[];
  color?: string;
  glow?: number;
}) {
  return (
    <mesh
      position={p as any}
      scale={s as any}
      geometry={orbGeometry}
      material={orbMaterial(color, glow)}
      castShadow
      dispose={null}
    />
  );
}
const poleGeometries = new Map<string, T.CylinderGeometry>();
function poleGeometry(r: number, h: number) {
  const key = `${r}:${h}`;
  let geometry = poleGeometries.get(key);
  if (!geometry) {
    geometry = new T.CylinderGeometry(r * 0.85, r, h, 14);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * Math.PI * 2 * r * 0.65, uv.getY(i) * h * 0.65);
    poleGeometries.set(key, geometry);
  }
  return geometry;
}
export function Pole({
  p = [0, 0, 0],
  r = 0.1,
  h = 1,
  color = mat.wood,
  rotation = [0, 0, 0],
}: {
  p?: number[];
  r?: number;
  h?: number;
  color?: string;
  rotation?: number[];
}) {
  return (
    <mesh
      position={p as any}
      rotation={rotation as any}
      geometry={poleGeometry(r, h)}
      material={surface(color, 0)}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
export function Sign({
  text,
  p = [0, 0, 0],
  width = 2,
  color = "#eee0bb",
  background = "#354847",
}: {
  text: string;
  p?: number[];
  width?: number;
  color?: string;
  background?: string;
}) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 192;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 744, 168);
    ctx.fillStyle = color;
    ctx.font = "500 40px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 384, 96, 700);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }, [text, color, background]);
  return (
    <mesh position={p as any}>
      <planeGeometry args={[width, width / 4]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
let lanternFrame: T.BufferGeometry | undefined;
export function lanternFrameGeometry() {
  if (!lanternFrame) {
    const pieces: T.BufferGeometry[] = [
      poleGeometry(0.26, 0.06).clone().translate(0, 0.12, 0),
      poleGeometry(0.23, 0.06).clone().translate(0, 0.67, 0),
      new T.TorusGeometry(0.11, 0.018, 6, 16).translate(0, 0.8, 0),
    ];
    for (let i = 0; i < 4; i++)
      pieces.push(
        poleGeometry(0.012, 0.48)
          .clone()
          .translate(
            Math.cos((i * Math.PI) / 2) * 0.24,
            0.4,
            Math.sin((i * Math.PI) / 2) * 0.24,
          ),
      );
    // A single material means the entire iron frame is one draw call.
    lanternFrame = mergeGeometries(pieces, false)!;
    pieces.forEach((geometry) => geometry.dispose());
  }
  return lanternFrame;
}
export function lanternFrameMaterial() {
  return surface(mat.iron, 0, "metal");
}
const lanternBodies = new Map<number, T.BufferGeometry>();
const lanternPaperMaterials = new Map<string, T.MeshStandardMaterial>();
function lanternPaperMaterial(color: string, lit: boolean) {
  const key = `${color}:${lit}`;
  let material = lanternPaperMaterials.get(key);
  if (!material) {
    material = new T.MeshStandardMaterial({
      color: lit ? color : "#b59c76",
      emissive: color,
      map: paperMap(),
      emissiveMap: paperMap(),
      emissiveIntensity: lit ? 0.65 : 0,
      roughness: 0.8,
    });
    lanternPaperMaterials.set(key, material);
  }
  return material;
}
export function lanternBodyGeometry(shape = 0) {
  const key = shape === 1 ? 1 : shape === 2 ? 2 : 0;
  let geometry = lanternBodies.get(key);
  if (!geometry) {
    geometry =
      key === 1
        ? new T.SphereGeometry(0.25, 12, 10)
        : key === 2
          ? new T.CylinderGeometry(0.2, 0.28, 0.46, 6)
          : new T.CylinderGeometry(0.23, 0.23, 0.46, 12);
    lanternBodies.set(key, geometry);
  }
  return geometry;
}
export function Lantern({
  position = [0, 0, 0],
  color = "#ffcc75",
  lit = true,
  shape = 0,
  scale = 1,
}: {
  position?: number[];
  color?: string;
  lit?: boolean;
  shape?: number;
  scale?: number;
}) {
  return (
    <group position={position as any} scale={scale}>
      <mesh
        position={[0, 0.4, 0]}
        geometry={lanternBodyGeometry(shape)}
        material={lanternPaperMaterial(color, lit)}
        castShadow
        dispose={null}
      />
      <mesh
        geometry={lanternFrameGeometry()}
        material={lanternFrameMaterial()}
        castShadow
        receiveShadow
        dispose={null}
      />
    </group>
  );
}
export function Produce({
  kind,
  position = [0, 0, 0],
  scale = 1,
}: {
  kind: string;
  position?: number[];
  scale?: number;
}) {
  return (
    <group position={position as any} scale={scale}>
      {kind === "wood" ? (
        <>
          <Pole
            p={[0, 0.2, 0]}
            r={0.18}
            h={1.3}
            rotation={[0, 0, Math.PI / 2]}
          />
          <Pole
            p={[0.1, 0.37, 0.2]}
            r={0.12}
            h={1}
            rotation={[0.1, 0, Math.PI / 2]}
          />
        </>
      ) : kind === "mushroom" ? (
        <>
          <Pole p={[0, 0.23, 0]} r={0.1} h={0.45} color="#e6d8b5" />
          <Orb p={[0, 0.49, 0]} s={[0.34, 0.18, 0.34]} color="#c36b43" />
          <Orb p={[0.12, 0.62, 0.04]} s={[0.05, 0.018, 0.05]} color="#f3e2be" />
          <Orb p={[-0.13, 0.6, 0.07]} s={[0.04, 0.018, 0.04]} color="#f3e2be" />
        </>
      ) : kind === "pumpkin" ? (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <Orb
              key={i}
              p={[
                Math.cos((i * Math.PI) / 4) * 0.16,
                0.32,
                Math.sin((i * Math.PI) / 4) * 0.16,
              ]}
              s={[0.23, 0.31, 0.23]}
              color={i % 2 ? "#d27b28" : "#d78b32"}
            />
          ))}
          <Pole p={[0, 0.68, 0]} r={0.055} h={0.18} color="#5e6b3c" />
        </>
      ) : (
        <>
          <Orb p={[0, 0.28, 0]} s={[0.25, 0.24, 0.25]} color="#c75137" />
          <Pole p={[0, 0.55, 0]} r={0.023} h={0.15} />
          <Orb p={[0.09, 0.56, 0]} s={[0.12, 0.025, 0.055]} color="#66743f" />
        </>
      )}
    </group>
  );
}
export function Cottage({
  position = [0, 0, 0],
  rotation = 0,
  color = "#bda47d",
  scale = 1,
}: {
  position?: number[];
  rotation?: number;
  color?: string;
  scale?: number;
}) {
  return (
    <group position={position as any} rotation={[0, rotation, 0]} scale={scale}>
      <StaticGeometry revision={color}>
        <Box
          p={[0, 1.6, 0]}
          s={[6, 3.2, 4.8]}
          color={color}
          material="plaster"
        />
        <Box
          p={[0, 0.2, 0]}
          s={[6.3, 0.4, 5.1]}
          color={mat.stone}
          material="stone"
        />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Box
              p={[side * 1.65, 3.8, 0]}
              s={[3.9, 0.22, 5.9]}
              color={mat.roof}
              material="roof"
              rot={[0, 0, side * -0.52]}
            />
            {[-2, -1, 0, 1, 2].map((i) => (
              <Box
                key={i}
                p={[side * 1.65, 3.82, i * 1.06]}
                s={[3.95, 0.1, 0.035]}
                color="#65706b"
                rot={[0, 0, side * -0.52]}
              />
            ))}
          </group>
        ))}
        <Box p={[0, 2.8, 2.44]} s={[6, 0.17, 0.17]} />
        {[-2.85, 2.85].map((x) => (
          <Box key={x} p={[x, 1.7, 2.45]} s={[0.18, 3, 0.2]} />
        ))}
        {/* The center timber ends above the doorway; coplanar door/post faces shimmer. */}
        <Box p={[0, 2.75, 2.45]} s={[0.18, 0.9, 0.2]} />
        <Box p={[0, 1.05, 2.51]} s={[1.18, 2.1, 0.16]} color="#385b58" />
        <Orb p={[0.38, 1.07, 2.64]} s={[0.045, 0.045, 0.045]} color="#dca84f" />
        {[-1.8, 1.8].map((x) => (
          <group key={x}>
            <Box p={[x, 1.85, 2.5]} s={[1.22, 1.36, 0.12]} color="#4e483b" />
            <Box
              p={[x, 1.85, 2.58]}
              s={[1, 1.15, 0.06]}
              color="#ffc879"
              glow={1.2}
            />
            <Box p={[x, 1.85, 2.64]} s={[0.06, 1.25, 0.05]} />
            {[-1, 1].map((side) => (
              <Box
                key={side}
                p={[x + side * 0.29, 1.85, 2.64]}
                s={[0.52, 0.06, 0.05]}
              />
            ))}
            <Box p={[x, 1.1, 2.7]} s={[1.5, 0.18, 0.55]} color="#79523b" />
            <Orb p={[x, 1.28, 2.8]} s={[0.6, 0.15, 0.17]} color="#7b8c51" />
          </group>
        ))}
        <Box
          p={[1.8, 4.6, -0.8]}
          s={[0.7, 2.2, 0.8]}
          color="#8d8070"
          material="stone"
        />
        <Box
          p={[1.8, 5.7, -0.8]}
          s={[0.9, 0.18, 1]}
          color="#75695e"
          material="stone"
        />
        <Box
          p={[0, 0.12, 3.2]}
          s={[1.8, 0.24, 1.4]}
          color="#b1a08a"
          material="stone"
        />
        <Lantern position={[2.6, 1.3, 2.9]} scale={0.7} />
      </StaticGeometry>
    </group>
  );
}
export function Avatar({
  role,
  moving = false,
  held = "",
  ghost = false,
}: {
  role: Role;
  moving?: boolean;
  held?: string;
  ghost?: boolean;
}) {
  const group = useRef<T.Group>(null),
    legs = useRef<T.Group>(null),
    arms = useRef<T.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const walk = moving ? Math.sin(t * 10) * 0.45 : Math.sin(t * 1.8) * 0.025;
    if (group.current)
      group.current.position.y = moving
        ? Math.abs(Math.sin(t * 10)) * 0.035
        : 0;
    if (legs.current) {
      legs.current.children[0].rotation.x = walk;
      legs.current.children[1].rotation.x = -walk;
    }
    if (arms.current) {
      arms.current.children[0].rotation.x = -walk * 0.7;
      arms.current.children[1].rotation.x = walk * 0.7;
    }
  });
  return (
    <group ref={group}>
      <group ref={legs}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.13, 0.58, 0]}>
            <Pole p={[0, -0.21, 0]} r={0.105} h={0.46} color="#394344" />
            <Box p={[0, -0.5, 0.045]} s={[0.23, 0.18, 0.36]} color="#4b3329" />
            <Box
              p={[0, -0.59, 0.045]}
              s={[0.24, 0.035, 0.37]}
              color="#252c2c"
            />
          </group>
        ))}
      </group>
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.29, 0.46, 5, 12]} />
        <meshStandardMaterial color={colors[role]} roughness={0.93} />
      </mesh>
      <mesh position={[0, 0.67, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.36, 0.27, 12]} />
        <meshStandardMaterial color={colors[role]} />
      </mesh>
      <Box p={[0, 1.12, -0.29]} s={[0.41, 0.49, 0.21]} color="#755440" />
      <Box p={[0, 1.38, -0.29]} s={[0.44, 0.13, 0.25]} color="#9b7856" />
      <Pole
        p={[0, 1.34, 0]}
        r={0.26}
        h={0.12}
        color={role ? "#ce8e5f" : "#526e66"}
      />
      <Box
        p={[0.14, 1.2, 0.26]}
        s={[0.13, 0.36, 0.06]}
        color={role ? "#ce8e5f" : "#526e66"}
      />
      <Orb
        p={[0, 1.57, 0]}
        s={[0.24, 0.27, 0.23]}
        color={role ? "#bc8b6a" : "#a87656"}
      />
      <Orb p={[0, 1.74, -0.02]} s={[0.25, 0.13, 0.24]} color="#342b28" />
      <Pole
        p={[0, 1.83, 0]}
        r={0.265}
        h={0.17}
        color={role ? "#547672" : "#b8803d"}
      />
      <Pole
        p={[0, 1.76, 0]}
        r={0.31}
        h={0.07}
        color={role ? "#547672" : "#b8803d"}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Orb
            p={[side * 0.08, 1.6, 0.208]}
            s={[0.025, 0.032, 0.018]}
            color="#302825"
          />
          <Orb
            p={[side * 0.235, 1.56, 0]}
            s={[0.045, 0.07, 0.04]}
            color="#b17e5b"
          />
        </group>
      ))}
      <Orb p={[0, 1.55, 0.23]} s={[0.045, 0.045, 0.05]} color="#b28160" />
      <group ref={arms}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.32, 1.2, 0]}>
            <Pole
              p={[side * 0.035, -0.22, 0]}
              r={0.105}
              h={0.43}
              color={colors[role]}
            />
            <Orb
              p={[side * 0.04, -0.48, 0]}
              s={[0.09, 0.105, 0.09]}
              color="#b78563"
            />
            {side === 1 && held && (
              <Produce
                kind={held}
                position={[0.03, -0.55, 0.19]}
                scale={0.65}
              />
            )}
          </group>
        ))}
      </group>
      {[0.82, 1, 1.17].map((y) => (
        <Orb
          key={y}
          p={[0, y, 0.285]}
          s={[0.025, 0.025, 0.016]}
          color="#ead2a0"
        />
      ))}
    </group>
  );
}
let foliageTexture: T.Texture | undefined;
function autumnFoliageTexture() {
  if (!foliageTexture) {
    foliageTexture = new T.TextureLoader().load(
      "/textures/autumn-leaf-cluster.webp",
    );
    foliageTexture.colorSpace = T.SRGBColorSpace;
    foliageTexture.anisotropy = 4;
  }
  return foliageTexture;
}

export function Forest({
  phase = 0,
  river = false,
}: {
  phase?: number;
  river?: boolean;
}) {
  const leaves = useRef<T.InstancedMesh>(null),
    trunk = useRef<T.InstancedMesh>(null),
    branches = useRef<T.InstancedMesh>(null),
    canopy = useRef<T.InstancedMesh>(null),
    grass = useRef<T.InstancedMesh>(null);
  const data = useMemo(() => {
    const trees = [];
    if (river) {
      for (let i = 0; i < 220; i++)
        trees.push({
          x: (i % 2 ? 1 : -1) * (20 + rand(i + 99) * 22),
          z: 70 - Math.floor(i / 2) * 10 + (rand(i + 300) - 0.5) * 7,
          s: 1 + rand(i + 21) * 1.5,
        });
      return trees;
    }
    for (let i = 0; i < 180; i++) {
      const a = rand(i + 40) * Math.PI * 2,
        r = 64 + rand(i + 70) * 55;
      trees.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        s: 1 + rand(i + 90) * 1.7,
      });
    }
    for (let i = 0; i < 30; i++) {
      const a = i * 2.399,
        r = 10 + rand(i) * 29;
      trees.push({
        x: -26 + Math.cos(a) * r,
        z: -13 + Math.sin(a) * r,
        s: 0.8 + rand(i + 77) * 0.8,
      });
    }
    return trees.filter(
      (t) =>
        !(t.z < -58 && t.z > -79) &&
        ![
          [-45, -8],
          [-49, -13],
          [-18, 8],
          [-20, 11],
          [-15, 11],
        ].some(([x, z]) => Math.hypot(t.x - x, t.z - z) < 5),
    );
  }, [river]);
  useMemo(() => {}, []);
  // Matrices are initialized before the first displayed frame.
  const initialized = useRef(false);
  useFrame(() => {
    if (
      initialized.current ||
      !leaves.current ||
      !trunk.current ||
      !branches.current ||
      !canopy.current ||
      !grass.current
    )
      return;
    initialized.current = true;
    const o = new T.Object3D(),
      c = new T.Color();
    data.forEach((t, i) => {
      const baseY = river ? riverGroundHeight(t.x, t.z) : 0;
      o.position.set(t.x, baseY + t.s * 2.5, t.z);
      o.scale.set(t.s * 0.3, t.s * 5, t.s * 0.3);
      o.rotation.set(0, rand(i) * 6, 0.04);
      o.updateMatrix();
      trunk.current!.setMatrixAt(i, o.matrix);
      for (let j = 0; j < 3; j++) {
        const angle = j * 2.399 + rand(i) * 6;
        o.position.set(
          t.x + Math.cos(angle) * t.s * 0.6,
          baseY + t.s * 3.8,
          t.z + Math.sin(angle) * t.s * 0.6,
        );
        o.scale.set(t.s * 0.1, t.s * 2.8, t.s * 0.1);
        // Forks grow outward from the trunk; the negative Z angle keeps their roots attached.
        o.rotation.set(Math.sin(angle) * 0.55, 0, -Math.cos(angle) * 0.55);
        o.updateMatrix();
        branches.current!.setMatrixAt(i * 3 + j, o.matrix);
      }
      for (let j = 0; j < 22; j++) {
        const a = j * 2.399 + rand(i),
          r = Math.sqrt(rand(i * 31 + j)) * 2.6;
        const y = 4.8 + rand(i * 13 + j) * 2.6;
        o.position.set(
          t.x + Math.cos(a) * t.s * r,
          baseY + t.s * y,
          t.z + Math.sin(a) * t.s * r,
        );
        o.scale.set(
          t.s * (0.7 + rand(i + j) * 0.65),
          t.s * (0.7 + rand(i + j + 10) * 0.55),
          t.s * (0.7 + rand(i + j + 22) * 0.6),
        );
        o.rotation.set(rand(j), rand(i) * 5, rand(i + j));
        o.updateMatrix();
        canopy.current!.setMatrixAt(i * 22 + j, o.matrix);
        c.set(
          ["#f4eddf", "#eee4cc", "#e5ddce", "#f4e2c8", "#e0e0cb", "#d7dfcf"][
            Math.floor(rand(i) * 6)
          ],
        ).multiplyScalar(0.82 + rand(i * 7 + j) * 0.2);
        canopy.current!.setColorAt(i * 22 + j, c);
        for (let k = 0; k < 10; k++) {
          const n = i * 220 + j * 10 + k,
            az = rand(n + 900) * 6.28,
            el = rand(n + 1000) * Math.PI;
          const radius = t.s * (0.75 + rand(n + 2000) * 0.4);
          o.position.set(
            t.x + Math.cos(a) * t.s * r + Math.cos(az) * Math.sin(el) * radius,
            baseY + t.s * y + Math.cos(el) * radius,
            t.z + Math.sin(a) * t.s * r + Math.sin(az) * Math.sin(el) * radius,
          );
          o.scale.set(
            t.s * (0.66 + rand(n) * 0.57),
            t.s * (0.66 + rand(n) * 0.57),
            1,
          );
          o.rotation.set(
            rand(n) * 6.28,
            rand(n + 50) * 6.28,
            rand(n + 60) * 6.28,
          );
          o.updateMatrix();
          leaves.current!.setMatrixAt(n, o.matrix);
          leaves.current!.setColorAt(n, c);
        }
      }
    });
    for (let i = 0; i < 9000; i++) {
      const a = rand(i + 700) * 6.28,
        r = 8 + Math.sqrt(rand(i + 800)) * 86;
      let gx = Math.cos(a) * r,
        gz = Math.sin(a) * r;
      if (Math.abs(gx) < 4.2) gx += Math.sign(gx || 1) * 4.2;
      o.position.set(gx, 0.09, gz);
      o.scale.set(0.13 + rand(i) * 0.15, 0.25 + rand(i + 1) * 0.38, 0.13);
      o.rotation.set(0, rand(i) * 6, rand(i + 2) * 0.4);
      o.updateMatrix();
      grass.current.setMatrixAt(i, o.matrix);
      grass.current.setColorAt(i, c.set(i % 4 ? "#73774c" : "#a18b5b"));
    }
    leaves.current.instanceMatrix.needsUpdate = true;
    leaves.current.instanceColor!.needsUpdate = true;
    trunk.current.instanceMatrix.needsUpdate = true;
    branches.current.instanceMatrix.needsUpdate = true;
    canopy.current.instanceMatrix.needsUpdate = true;
    canopy.current.instanceColor!.needsUpdate = true;
    grass.current.instanceMatrix.needsUpdate = true;
    grass.current.instanceColor!.needsUpdate = true;
    [leaves, trunk, branches, canopy, grass].forEach((r) =>
      r.current?.computeBoundingSphere(),
    );
  });
  const grassGeometry = useMemo(() => {
    const positions: number[] = [],
      uv: number[] = [];
    // Five narrow, bent blades per tuft. The silhouette stays organic at eye
    // level without alpha overdraw or a separate draw call for each blade.
    for (let j = 0; j < 5; j++) {
      const a = j * 2.399,
        height = 0.65 + rand(j + 30) * 0.4;
      const dx = Math.cos(a),
        dz = Math.sin(a),
        width = 0.055;
      const root = new T.Vector3(dx * 0.23, -0.5, dz * 0.23);
      const middle = root
        .clone()
        .add(new T.Vector3(dx * 0.12, height * 0.6, dz * 0.12));
      const tip = root.clone().add(new T.Vector3(dx * 0.31, height, dz * 0.31));
      const side = new T.Vector3(-dz * width, 0, dx * width);
      const l = root.clone().sub(side),
        r = root.clone().add(side);
      const ml = middle.clone().addScaledVector(side, -0.52),
        mr = middle.clone().addScaledVector(side, 0.52);
      for (const v of [l, r, ml, r, mr, ml, ml, mr, tip])
        positions.push(v.x, v.y, v.z);
      uv.push(0, 0, 1, 0, 0, 0.6, 1, 0, 1, 0.6, 0, 0.6, 0, 0.6, 1, 0.6, 0.5, 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, []);
  const leafMap = useMemo(autumnFoliageTexture, []);
  return (
    <>
      <instancedMesh
        ref={leaves}
        args={[undefined, undefined, data.length * 220]}
        castShadow
      >
        <planeGeometry args={[1, 1]} />
        <WindMaterial map={leafMap} phase={phase} />
      </instancedMesh>
      <instancedMesh
        ref={trunk}
        args={[undefined, undefined, data.length]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.6, 1, 1, 14]} />
        <meshStandardMaterial
          color="#b9b1a5"
          {...pbrTextures("bark")}
          normalScale={new T.Vector2(0.65, 0.65)}
          onBeforeCompile={instanceBarkUV}
          roughness={1}
        />
      </instancedMesh>
      <instancedMesh
        ref={branches}
        args={[undefined, undefined, data.length * 3]}
        castShadow
      >
        <cylinderGeometry args={[0.3, 1, 1, 10]} />
        <meshStandardMaterial
          color="#bab2a5"
          {...pbrTextures("bark")}
          normalScale={new T.Vector2(0.6, 0.6)}
          onBeforeCompile={instanceBarkUV}
          roughness={1}
        />
      </instancedMesh>
      <instancedMesh
        ref={canopy}
        args={[undefined, undefined, data.length * 22]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[0.01, 0]} />
        <meshStandardMaterial roughness={1} visible={false} />
      </instancedMesh>
      <instancedMesh
        ref={grass}
        args={[undefined, undefined, 9000]}
        visible={!river}
        receiveShadow
      >
        <primitive object={grassGeometry} attach="geometry" />
        <WindMaterial grass phase={phase} />
      </instancedMesh>
    </>
  );
}
