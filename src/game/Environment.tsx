import { Box, Sphere, Cylinder, Plant, Lamp } from "./Primitives";
import { useMemo, Suspense } from "react";
import { useTexture } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import type { Place } from "./content";
const brass = "#b58a42",
  wood = "#6c422d",
  darkWood = "#3f2923",
  cream = "#dfceb0",
  green = "#315a4e";
function Solid({
  children,
  p = [0, 0, 0],
  size = [1, 1, 1],
  center = [0, 0.5, 0],
}: {
  children: React.ReactNode;
  p?: number[];
  size?: number[];
  center?: number[];
}) {
  return (
    <group position={p as any}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={size.map((x) => x / 2) as any}
          position={center as any}
        />
      </RigidBody>
      {children}
    </group>
  );
}
function Table({
  p = [0, 0, 0],
  size = [2.8, 1.1, 1.4],
  color = wood,
}: {
  p?: number[];
  size?: number[];
  color?: string;
}) {
  const [w, h, d] = size;
  return (
    <Solid p={p} size={[w, h, d]} center={[0, h / 2, 0]}>
      <Box p={[0, h, 0]} s={[w, 0.12, d]} color={color} />
      <Box
        p={[0, h - 0.12, 0]}
        s={[w - 0.14, 0.16, d - 0.14]}
        color={darkWood}
      />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Box
            key={`${x}${z}`}
            p={[x * (w / 2 - 0.16), h / 2, z * (d / 2 - 0.16)]}
            s={[0.1, h, 0.1]}
            color={color}
          />
        )),
      )}
    </Solid>
  );
}
function Chair({
  p = [0, 0, 0],
  rot = 0,
  color = green,
}: {
  p?: number[];
  rot?: number;
  color?: string;
}) {
  return (
    <group position={p as any} rotation={[0, rot, 0]}>
      <Solid size={[0.9, 0.9, 1]} center={[0, 0.45, 0]}>
        <Box p={[0, 0.63, 0]} s={[0.86, 0.16, 0.9]} color={color} />
        <Box p={[0, 1, -0.37]} s={[0.85, 0.7, 0.15]} color={color} />
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <Box
              key={`${x}${z}`}
              p={[x * 0.33, 0.28, z * 0.32]}
              s={[0.08, 0.56, 0.08]}
            />
          )),
        )}
      </Solid>
    </group>
  );
}
function Bookshelf({
  p = [0, 0, 0],
  w = 3.8,
  h = 3,
}: {
  p?: number[];
  w?: number;
  h?: number;
}) {
  return (
    <Solid p={p} size={[w, h, 0.65]} center={[0, h / 2, 0]}>
      <Box p={[0, h / 2, 0]} s={[w, h, 0.5]} color={darkWood} />
      {[0, 1, 2, 3].map((row) => (
        <group key={row} position={[0, 0.25 + (row * (h - 0.35)) / 4, 0.27]}>
          <Box p={[0, 0, 0]} s={[w + 0.1, 0.08, 0.64]} />
          {Array.from({ length: Math.floor(w / 0.2) - 2 }, (_, i) => (
            <Box
              key={i}
              p={[
                -w / 2 + 0.28 + i * 0.2,
                0.25 + Math.sin(i * 14 + row) * 0.045,
                0,
              ]}
              s={[0.13, 0.46 + Math.sin(i * 14 + row) * 0.09, 0.34]}
              color={
                [
                  "#778174",
                  "#ad704d",
                  "#baa378",
                  "#426260",
                  "#947076",
                  "#2b4147",
                ][(i + row * 3) % 6]
              }
              rot={[0, 0, i % 7 === 0 ? 0.08 : 0]}
            />
          ))}
        </group>
      ))}
      <Box p={[-w / 2, h / 2, 0.15]} s={[0.1, h, 0.8]} />
      <Box p={[w / 2, h / 2, 0.15]} s={[0.1, h, 0.8]} />
    </Solid>
  );
}
function Rug({
  p = [0, 0.012, 0],
  s = [5, 0.02, 3.5],
  color = "#af6b58",
}: {
  p?: number[];
  s?: number[];
  color?: string;
}) {
  return (
    <group>
      <Box p={p} s={s} color={color} cast={false} />
      <Box
        p={[p[0], p[1] + 0.012, p[2]]}
        s={[s[0] - 0.22, 0.01, s[2] - 0.22]}
        color="#c9ab79"
        cast={false}
      />
      <Box
        p={[p[0], p[1] + 0.019, p[2]]}
        s={[s[0] - 0.34, 0.01, s[2] - 0.34]}
        color={color}
        cast={false}
      />
      {[-1, 1].map((v) => (
        <Box
          key={v}
          p={[p[0] + v * s[0] * 0.32, p[1] + 0.025, p[2]]}
          s={[0.035, 0.005, s[2] - 0.5]}
          color="#d9bd90"
          cast={false}
        />
      ))}
    </group>
  );
}
function Sofa({ p = [0, 0, 0], rot = 0 }: { p?: number[]; rot?: number }) {
  return (
    <group position={p as any} rotation={[0, rot, 0]}>
      <Solid size={[3.8, 1.25, 1.5]} center={[0, 0.625, 0]}>
        <Box p={[0, 0.35, 0]} s={[3.6, 0.5, 1.4]} color="#a67555" />
        <Box p={[0, 0.95, -0.6]} s={[3.6, 0.85, 0.3]} color="#507263" />
        {[-1, 0, 1].map((i) => (
          <Box
            key={i}
            p={[i * 1.06, 0.66, 0.06]}
            s={[1.03, 0.26, 1.12]}
            color="#648574"
          />
        ))}
        {[-1, 1].map((i) => (
          <group key={i}>
            <Box p={[i * 1.8, 0.76, 0]} s={[0.3, 0.7, 1.5]} color="#507263" />
            <Sphere
              p={[i * 1.16, 1.01, -0.3]}
              s={[0.37, 0.37, 0.12]}
              color={i === -1 ? "#d1aa72" : "#d79c8a"}
            />
          </group>
        ))}
      </Solid>
    </group>
  );
}
function Window({ p = [0, 2, 0] }: { p?: number[] }) {
  return (
    <group position={p as any}>
      <Box s={[2.35, 2, 0.11]} color={darkWood} />
      <Box
        p={[0, 0, 0.075]}
        s={[2.05, 1.73, 0.035]}
        color="#618e91"
        emissive="#314d51"
      />
      {[-1, 0, 1].map((i) => (
        <Box
          key={i}
          p={[i * 1.06, 0, 0.14]}
          s={[0.065, 1.86, 0.06]}
          color={cream}
        />
      ))}
      <Box p={[0, 0, 0.14]} s={[2.2, 0.06, 0.06]} color={cream} />
      <Box p={[0, -1, 0.23]} s={[2.5, 0.1, 0.45]} color={cream} />
    </group>
  );
}
function Walls({
  color = "#43635a",
  windows = true,
}: {
  color?: string;
  windows?: boolean;
}) {
  return (
    <>
      <Box p={[0, 1.8, -10.75]} s={[24, 3.6, 0.3]} color={color} />
      <Box p={[-11.8, 1.2, 0]} s={[0.3, 2.4, 21.5]} color={color} />
      <Box p={[11.8, 1.2, 0]} s={[0.3, 2.4, 21.5]} color={color} />
      <Box p={[0, 0.48, -10.54]} s={[24, 0.92, 0.08]} color={darkWood} />
      <Box p={[0, 1, -10.48]} s={[24, 0.07, 0.12]} color={brass} />
      <Box p={[0, 0.12, -10.4]} s={[24, 0.17, 0.2]} color={cream} />
      <Box p={[0, 3.65, -10.7]} s={[24, 0.16, 0.45]} color={cream} />
      {Array.from({ length: 16 }, (_, i) => (
        <Box
          key={i}
          p={[-11 + i * 1.45, 0.48, -10.46]}
          s={[0.035, 0.78, 0.025]}
          color={brass}
        />
      ))}
      {windows &&
        [-8, -4, 4, 8].map((x) => <Window key={x} p={[x, 2.28, -10.53]} />)}
    </>
  );
}
function woodTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#946b45";
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const x = (row % 2) * 120;
    for (let n = -1; n < 4; n++) {
      ctx.fillStyle = ["#976b48", "#a2744e", "#a67b52", "#916640"][
        (n + row + 4) % 4
      ];
      ctx.fillRect(x + n * 240 + 1, row * 64 + 1, 238, 62);
    }
  }
  for (let i = 0; i < 1300; i++) {
    let v = Math.sin(i * 72.131) * 43758.5453;
    v -= Math.floor(v);
    ctx.fillStyle = `rgba(42,22,10,${0.02 + v * 0.05})`;
    ctx.fillRect((i * 131) % 512, (i * 71) % 512, 5 + v * 70, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function Floor({ place }: { place: Place }) {
  const tex = useMemo(woodTexture, []);
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[12, 0.3, 11]} position={[0, -0.3, 0]} />
        {[-1, 1].map((i) => (
          <group key={i}>
            <CuboidCollider args={[0.2, 3, 11]} position={[i * 12, 2, 0]} />
            <CuboidCollider args={[12, 3, 0.2]} position={[0, 2, i * 11]} />
          </group>
        ))}
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 22]} />
        <meshStandardMaterial
          map={place === "house" || place === "loft" ? tex : null}
          color={
            place === "garden"
              ? "#41614e"
              : place === "lab"
                ? "#577477"
                : place === "observatory"
                  ? "#344956"
                  : "#ffffff"
          }
          roughness={0.87}
        />
      </mesh>
      <Box
        p={[0, -0.38, 0]}
        s={[24.4, 0.72, 22.4]}
        color={place === "garden" ? "#354532" : darkWood}
      />
      <Box p={[0, -0.12, 10.98]} s={[24.4, 0.16, 0.12]} color={brass} />
    </>
  );
}
export function PhotoFrame({ photo = 1 }: { photo?: number }) {
  const tex = useTexture(`/api/photo?id=${photo}&thumb=1`);
  const ratio =
    (tex.image as HTMLImageElement).width /
    (tex.image as HTMLImageElement).height;
  const w = Math.min(1.1, 0.84 * ratio),
    h = w / ratio;
  return (
    <group>
      <Box p={[0, 0, -0.035]} s={[1.25, 1.01, 0.09]} color={brass} />
      <Box s={[1.14, 0.9, 0.03]} color="#e9d9b7" />
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Box p={[0, -0.56, -0.08]} s={[0.75, 0.13, 0.4]} color={wood} />
    </group>
  );
}
function House() {
  return (
    <>
      <Walls />
      <Rug p={[0, 0.014, 5.7]} s={[4, 0.02, 8.7]} color="#9b594b" />
      <Rug p={[-7, 0.014, 3.6]} s={[6.5, 0.02, 5.8]} color="#596c6e" />
      <Sofa p={[-8, 0, 1.4]} />
      <Chair p={[-10, 0, 5]} rot={0.8} />
      <Table p={[-8, 0, 4]} size={[2.4, 0.75, 1.25]} />
      <Lamp p={[-10.5, 0, 1.7]} />
      <Plant p={[-10.8, 0, 8.2]} scale={1.6} />
      <Table p={[0, 0, 5]} size={[3, 1, 0.95]} />
      <Table p={[-9, 0, -7]} size={[3, 1.1, 1.7]} />
      <Chair p={[-9, 0, -5.5]} />
      <Bookshelf p={[-7, 0, -10]} />
      <Lamp p={[-10.4, 1.14, -7]} height={0.8} />
      <Box p={[-9, 1.17, -7]} s={[0.8, 0.015, 0.6]} color={cream} />
      <Rug p={[-8, 0.014, -6]} s={[5.5, 0.02, 5]} color="#9b6655" />
      <Table p={[8, 0, 3]} size={[4, 1.05, 2.6]} color="#a58964" />
      {[-1, 1].map((x) => (
        <group key={x}>
          <Chair p={[8 + x * 1.1, 0, 5]} color="#c0a078" />
          {[-1, 1].map((z) => (
            <Cylinder
              key={z}
              p={[8 + x * 0.8, 1.15, 3 + z * 0.7]}
              r={0.25}
              h={0.025}
              color={cream}
            />
          ))}
        </group>
      ))}
      <Cylinder p={[8, 1.31, 3]} r={0.12} h={0.24} color="#cfbd92" />
      <Plant p={[10, 0, 7.8]} scale={1.4} />
      <Solid p={[10, 0, -2]} size={[2.5, 1.4, 2]} center={[0, 0.7, 0]}>
        <Box p={[0, 0.65, 0]} s={[2.5, 1.3, 2]} color="#557466" />
        <Box p={[0, 1.34, 0]} s={[2.65, 0.12, 2.1]} color="#d3c7ae" />
        {[-1, 1].map((x) => (
          <Box
            key={x}
            p={[x * 0.6, 0.7, 1.02]}
            s={[1.06, 1, 0.06]}
            color="#6c8877"
          />
        ))}
      </Solid>
      <Table p={[7, 0, -7]} size={[3.2, 1.1, 1.7]} color="#342b29" />
      <Box p={[7, 1.5, -7.5]} s={[3, 0.75, 0.28]} color="#282725" />
      {Array.from({ length: 22 }, (_, i) => (
        <Box
          key={i}
          p={[5.55 + i * 0.13, 1.21, -6.6]}
          s={[0.12, 0.055, 0.45]}
          color="#e4dcc5"
        />
      ))}
      <Chair p={[7, 0, -5.5]} />
      <Lamp p={[9.2, 0, -7]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          {[-8, -0.5, 8].map((z) => (
            <Solid
              key={z}
              p={[side * 3.2, 0, z]}
              size={[0.2, 2, z === -0.5 ? 4 : 3.5]}
              center={[0, 1, 0]}
            >
              <Box
                p={[0, 1, 0]}
                s={[0.2, 2, z === -0.5 ? 4 : 3.5]}
                color="#627363"
              />
            </Solid>
          ))}
          <Box p={[side * 3.2, 2.8, 0]} s={[0.28, 0.2, 21]} color={darkWood} />
        </group>
      ))}
      <Plant p={[-2.3, 0, -8.8]} scale={1.4} />
      <Plant p={[2.3, 0, -8.8]} scale={1.4} />
      {Array.from({ length: 6 }, (_, i) => (
        <Box
          key={i}
          p={[10, 0.06 + i * 0.065, -8.2 - i * 0.36]}
          s={[1.5, 0.12 + i * 0.13, 0.36]}
          color="#a88a60"
        />
      ))}
    </>
  );
}
function Loft() {
  return (
    <>
      <Walls color="#4c5a63" windows={false} />
      <Rug p={[0, 0.02, 0]} s={[8, 0.02, 8]} color="#855850" />
      {[-8, -4, 0, 4, 8].map((x) => (
        <Bookshelf key={x} p={[x, 0, -10]} w={3.7} h={3.3} />
      ))}
      <Table p={[0, 0, 0]} size={[4, 1.05, 2.4]} />
      <Chair p={[-1, 0, 2]} />
      <Chair p={[1, 0, 2]} color="#9a6e74" />
      {[
        [-8, 4],
        [8, 4],
        [-8, -4],
        [8, -4],
        [0, -8],
      ].map(([x, z], i) => (
        <group key={i}>
          <Table p={[x, 0, z]} size={[2.8, 1, 1.4]} />
          <Lamp p={[x + 1, 1.05, z]} height={0.7} />
        </group>
      ))}
      <Sofa p={[-7, 0, 7]} rot={Math.PI} />
      <Plant p={[10, 0, 7]} scale={1.8} />
      <Plant p={[-10, 0, -8]} scale={1.4} />
      <Lamp p={[-3, 0, -3]} />
      <Lamp p={[3, 0, -3]} />
      <Cylinder p={[6, 1, -1]} r={0.38} h={1.8} color={brass} />
      <Sphere p={[6, 2, -1]} s={[0.58, 0.58, 0.58]} color="#667c79" />
    </>
  );
}
function Garden() {
  return (
    <>
      <Box
        p={[0, 0.006, 0]}
        s={[3.8, 0.012, 21]}
        color="#889383"
        cast={false}
      />
      <Box p={[0, 0.015, -4]} s={[20, 0.018, 3]} color="#889383" cast={false} />
      {[-1, 1].map((side) => (
        <group key={side}>
          {[-6, 4].map((z) => (
            <group key={z}>
              <Solid
                p={[side * 8, 0, z]}
                size={[4, 0.6, 4]}
                center={[0, 0.3, 0]}
              >
                <Box p={[0, 0.3, 0]} s={[4, 0.6, 4]} color="#766a52" />
                <Box p={[0, 0.62, 0]} s={[3.7, 0.04, 3.7]} color="#3c3a2b" />
              </Solid>
              {Array.from({ length: 9 }, (_, i) => (
                <Plant
                  key={i}
                  p={[
                    side * 8 + ((i % 3) - 1),
                    0.65,
                    z + (Math.floor(i / 3) - 1),
                  ]}
                  scale={0.7}
                  flower={i % 2 === 0}
                />
              ))}
            </group>
          ))}
          {[-9, -4, 1, 6].map((z) => (
            <group key={z}>
              <Cylinder
                p={[side * 11, 1.4, z]}
                r={0.13}
                h={2.8}
                color="#394c37"
              />
              <Sphere
                p={[side * 11, 2.7, z]}
                s={[1.1, 1.6, 1.1]}
                color={z % 2 ? "#335e46" : "#3d6d4e"}
              />
            </group>
          ))}
          <Box p={[side * 11.6, 0.6, 0]} s={[0.1, 1.2, 22]} color="#809782" />
        </group>
      ))}
      <Box p={[0, 0.6, -10.8]} s={[24, 1.2, 0.12]} color="#819781" />
      <Table p={[0, 0, -7]} size={[2.5, 1.1, 1.1]} color="#52786c" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cylinder
            p={[s * 3, 0.04, -4]}
            r={0.92}
            h={0.07}
            color={s === -1 ? "#689f90" : "#b57990"}
          />
          <mesh position={[s * 3, 0.09, -4]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.75, 0.025, 8, 48]} />
            <meshStandardMaterial
              color={s === -1 ? "#b6ffdd" : "#ffd0df"}
              emissive={s === -1 ? "#73d2ac" : "#d389af"}
              emissiveIntensity={1}
            />
          </mesh>
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 0.4, 1.3]} position={[0, 0.4, 3]} />
      </RigidBody>
      <Cylinder p={[0, 0.4, 3]} r={1.3} h={0.65} color="#818376" />
      <Cylinder p={[0, 0.73, 3]} r={1.19} h={0.02} color="#5e9a9c" />
      <Cylinder p={[0, 1.15, 3]} r={0.18} h={0.8} color="#8f8e78" />
      <Cylinder p={[0, 1.57, 3]} r={0.65} h={0.12} color="#a0a086" />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cylinder p={[s * 5, 2, 7]} r={0.05} h={4} color={brass} />
          {Array.from({ length: 7 }, (_, i) => (
            <mesh
              key={i}
              position={[
                s * 5,
                3.6 - Math.sin((i / 6) * Math.PI) * 0.35,
                7 - i * 2.7,
              ]}
            >
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial
                color="#ffe3a3"
                emissive="#ffd185"
                emissiveIntensity={3}
              />
            </mesh>
          ))}
        </group>
      ))}
      <Table p={[7, 0, 5]} size={[1.6, 1, 1]} />
    </>
  );
}
function Lab() {
  return (
    <>
      <Walls color="#294a50" windows={false} />
      {[-9, -5, 5, 9].map((x) => (
        <group key={x}>
          <Cylinder p={[x, 1.6, -10.4]} r={0.11} h={3.2} color={brass} />
          <Box p={[x, 3.2, -8.5]} s={[0.16, 0.16, 4]} color={brass} />
        </group>
      ))}
      <Rug p={[0, 0.016, -2]} s={[4, 0.02, 10]} color="#33535b" />
      {[
        [-8, 5],
        [8, 5],
        [-8, -5],
        [8, -5],
      ].map(([x, z], i) => (
        <group key={i}>
          <Table p={[x, 0, z]} size={[3.5, 1.05, 1.7]} color="#4d6463" />
          <Box
            p={[x + 0.7, 1.4, z - 0.25]}
            s={[0.8, 0.55, 0.5]}
            color="#203b40"
          />
          <Box
            p={[x + 0.7, 1.4, z + 0.01]}
            s={[0.62, 0.35, 0.01]}
            color="#709b89"
            emissive="#4f9878"
          />
          {[0, 1, 2].map((n) => (
            <Cylinder
              key={n}
              p={[x - 0.9 + n * 0.35, 1.35, z]}
              r={0.085}
              h={0.5 + n * 0.08}
              color={["#9eac83", "#bfa780", "#79a09c"][n]}
            />
          ))}
        </group>
      ))}
      <Table p={[0, 0, -6]} size={[3.5, 1.1, 1.5]} color="#58675b" />
      <Box p={[0, 1.55, -6.5]} s={[3, 0.7, 0.25]} color="#22383d" />
      {[-1, 0, 1].map((x) => (
        <mesh key={x} position={[x * 0.8, 1.58, -6.34]}>
          <circleGeometry args={[0.22, 24]} />
          <meshStandardMaterial
            color="#bad7b0"
            emissive="#699882"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      <Table p={[7, 0, -6]} size={[2, 1, 1]} />
      <Solid p={[4.6, 0, 0]} size={[1.7, 2.4, 1.7]} center={[0, 1.2, 0]}>
        <Cylinder p={[0, 1.15, 0]} r={0.75} h={2.3} color="#526d70" />
        <Cylinder p={[0, 2.37, 0]} r={0.8} h={0.13} color={brass} />
        <Cylinder p={[0, 0.12, 0]} r={0.8} h={0.13} color={brass} />
      </Solid>
      <Solid p={[-4.6, 0, 0]} size={[1.7, 2.4, 1.7]} center={[0, 1.2, 0]}>
        <Cylinder p={[0, 1.15, 0]} r={0.75} h={2.3} color="#526d70" />
        <Cylinder p={[0, 2.37, 0]} r={0.8} h={0.13} color={brass} />
        <Cylinder p={[0, 0.12, 0]} r={0.8} h={0.13} color={brass} />
      </Solid>
      <Box
        p={[0, 0.045, 6.5]}
        s={[18, 0.04, 0.07]}
        color="#b7b475"
        cast={false}
      />
      <Lamp p={[-10, 0, 0]} height={2.3} />
      <Lamp p={[10, 0, 0]} height={2.3} />
    </>
  );
}
function Observatory() {
  return (
    <>
      <Walls color="#253c4d" />
      <Cylinder p={[0, 0.035, -2]} r={5} h={0.04} color="#a68b52" />
      <Cylinder p={[0, 0.06, -2]} r={4.87} h={0.025} color="#2a4553" />
      {[2.2, 3.2, 4.4].map((r) => (
        <mesh key={r} position={[0, 0.085, -2]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.022, 8, 96]} />
          <meshStandardMaterial color={brass} metalness={0.4} />
        </mesh>
      ))}
      <Table p={[0, 0, -2]} size={[2.5, 0.95, 2.5]} color="#61716b" />
      <group position={[0, 1.3, -2]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0.4 + i * 0.5, 0.3 + i * 0.6, 0]}>
            <torusGeometry args={[0.72 + i * 0.07, 0.024, 10, 64]} />
            <meshStandardMaterial
              color={brass}
              metalness={0.55}
              roughness={0.4}
            />
          </mesh>
        ))}
        <Sphere p={[0, 0, 0]} s={[0.23, 0.23, 0.23]} color="#d7bc79" />
      </group>
      {[
        [-8, 4],
        [8, 4],
        [-7, -5],
        [7, -5],
        [0, -8.5],
      ].map(([x, z], i) => (
        <group key={i}>
          <Table p={[x, 0, z]} size={[2, 1.1, 1.1]} />
          <Lamp p={[x + 0.7, 1.12, z]} height={0.6} />
        </group>
      ))}
      <group position={[5, 0, -1]} rotation={[0, -0.8, 0]}>
        <Cylinder p={[0, 0.8, 0]} r={0.07} h={1.6} color={brass} />
        {[-1, 1].map((i) => (
          <Cylinder
            key={i}
            p={[i * 0.35, 0.45, 0]}
            r={0.045}
            h={1.1}
            color={brass}
            rot={[0, 0, i * 0.65]}
          />
        ))}
        <Cylinder
          p={[0, 1.8, 0]}
          r={0.23}
          r2={0.3}
          h={2.2}
          color="#9f8353"
          rot={[Math.PI / 3, 0, 0]}
        />
      </group>
      <Plant p={[-10, 0, 7]} scale={1.5} />
    </>
  );
}
export function Environment({ place }: { place: Place }) {
  return (
    <group>
      <Floor place={place} />
      {place === "house" ? (
        <House />
      ) : place === "loft" ? (
        <Loft />
      ) : place === "garden" ? (
        <Garden />
      ) : place === "lab" ? (
        <Lab />
      ) : (
        <Observatory />
      )}
    </group>
  );
}
export { Box, Plant, Table, Lamp };
