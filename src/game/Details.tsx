import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Box, Cylinder, Sphere } from "./Primitives";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Water, LightShafts, NightLandscape, Aurora } from "./Atmosphere";
import type { Place } from "./content";
const brass = "#b58a42";
function Ring({
  p = [0, 0, 0],
  r = 0.25,
  t = 0.018,
  rot = [Math.PI / 2, 0, 0],
  color = brass,
}: {
  p?: number[];
  r?: number;
  t?: number;
  rot?: number[];
  color?: string;
}) {
  return (
    <mesh position={p as any} rotation={rot as any} castShadow>
      <torusGeometry args={[r, t, 8, 48]} />
      <meshStandardMaterial color={color} metalness={0.65} roughness={0.28} />
    </mesh>
  );
}
function Cable({
  points,
  color = "#3a3830",
  radius = 0.014,
}: {
  points: number[][];
  color?: string;
  radius?: number;
}) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map(
          (p) => new THREE.Vector3(...(p as [number, number, number])),
        ),
      ),
    [points],
  );
  return (
    <mesh>
      <tubeGeometry args={[curve, 24, radius, 6, false]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}
function Tea({ p = [0, 0, 0] }: { p?: number[] }) {
  return (
    <group position={p as any}>
      <Cylinder p={[0, 0.02, 0]} r={0.22} h={0.02} color="#e7d9bc" />
      <Cylinder p={[0, 0.13, 0]} r={0.125} r2={0.1} h={0.2} color="#e7d9bc" />
      <Cylinder p={[0, 0.234, 0]} r={0.106} h={0.008} color="#492918" />
      <Ring
        p={[0.13, 0.15, 0]}
        r={0.069}
        t={0.019}
        rot={[0, Math.PI / 2, 0]}
        color="#dfceb0"
      />
      <Ring p={[0, 0.226, 0]} r={0.117} t={0.008} />
    </group>
  );
}
function Candle({ p = [0, 0, 0] }: { p?: number[] }) {
  const f = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (f.current)
      f.current.scale.y =
        0.067 * (0.95 + Math.sin(clock.elapsedTime * 6 + p[0]) * 0.1);
  });
  return (
    <group position={p as any}>
      <Cylinder p={[0, 0.025, 0]} r={0.13} h={0.05} color={brass} metal={0.7} />
      <Cylinder p={[0, 0.24, 0]} r={0.055} h={0.42} color="#ded2ae" />
      <mesh ref={f} position={[0, 0.5, 0]} scale={[0.027, 0.067, 0.027]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial color={[2.5, 1.2, 0.3]} />
      </mesh>
    </group>
  );
}
function Paper({ p = [0, 0, 0], rot = 0 }: { p?: number[]; rot?: number }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 384;
    const x = c.getContext("2d")!;
    x.fillStyle = "#e4d5b2";
    x.fillRect(0, 0, 256, 384);
    x.strokeStyle = "#696352";
    for (let i = 0; i < 17; i++) {
      x.beginPath();
      x.moveTo(25, 45 + i * 15);
      x.bezierCurveTo(
        80,
        38 + i * 15,
        130,
        53 + i * 15,
        210 - (i % 3) * 16,
        45 + i * 15,
      );
      x.stroke();
    }
    x.fillStyle = "#9e6260";
    x.beginPath();
    x.arc(193, 333, 17, 0, Math.PI * 2);
    x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={p as any} rotation={[-Math.PI / 2, 0, rot]}>
      <planeGeometry args={[0.6, 0.82]} />
      <meshStandardMaterial map={texture} roughness={0.94} />
    </mesh>
  );
}
function Chandelier({ p = [0, 4, 0] }: { p?: number[] }) {
  return (
    <group position={p as any}>
      <Cable
        points={[
          [0, 0, 0],
          [0, 1.5, 0],
        ]}
        color={brass}
        radius={0.022}
      />
      <Ring r={1.1} t={0.035} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <group key={i} position={[Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1]}>
            <Candle />
            <mesh position={[0, -0.18, 0]} scale={[0.04, 0.13, 0.04]}>
              <octahedronGeometry />
              <meshPhysicalMaterial
                color="#c7dfd9"
                metalness={0.25}
                roughness={0.13}
                transparent
                opacity={0.5}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
function Rugs({ place }: { place: Place }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 768;
    const x = c.getContext("2d")!;
    x.fillStyle = "#87614d";
    x.fillRect(0, 0, 768, 768);
    const cols = ["#d0b58b", "#4c6964", "#b7795b"];
    for (let r = 360; r > 30; r -= 28) {
      x.strokeStyle = cols[Math.floor(r / 28) % 3];
      x.lineWidth = r % 3 ? 6 : 2;
      x.beginPath();
      for (let j = 0; j <= 32; j++) {
        const a = (j * Math.PI) / 16,
          rr = r + (j % 2 ? 8 : 0);
        x.lineTo(384 + Math.cos(a) * rr, 384 + Math.sin(a) * rr);
      }
      x.closePath();
      x.stroke();
    }
    for (let i = 0; i < 768; i += 4) {
      x.fillStyle = "rgba(255,240,210,.05)";
      x.fillRect(i, 0, 1, 768);
      x.fillStyle = "rgba(20,20,15,.05)";
      x.fillRect(0, i, 768, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  if (place === "garden" || place === "lab" || place === "dream") return null;
  return (
    <mesh
      position={place === "house" ? [-7, 0.048, 3.6] : [0, 0.05, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={place === "house" ? [5.9, 5.2] : [7.6, 7.6]} />
      <meshStandardMaterial
        map={texture}
        roughness={1}
        bumpMap={texture}
        bumpScale={0.01}
      />
    </mesh>
  );
}
function Grass() {
  const geom = useMemo(() => {
    const vertices: number[] = [],
      colors: number[] = [];
    for (let i = 0; i < 3700; i++) {
      const x = Math.sin(i * 138.72) * 11.6,
        z = Math.cos(i * 73.213) * 10.5;
      if (
        Math.abs(x) < 2.2 ||
        Math.abs(z + 4) < 1.8 ||
        (Math.abs(x) > 5.8 &&
          Math.abs(x) < 10.3 &&
          (Math.abs(z - 4) < 2.2 || Math.abs(z + 6) < 2.2))
      )
        continue;
      const h = 0.1 + (Math.sin(i * 5.17) * 0.5 + 0.5) * 0.3,
        w = 0.028;
      vertices.push(
        x - w,
        0.02,
        z,
        x + w,
        0.02,
        z,
        x + Math.sin(i) * 0.08,
        h,
        z + 0.055,
      );
      const c = new THREE.Color().setHSL(
        0.25 + (i % 7) * 0.005,
        0.27,
        0.24 + (i % 9) * 0.015,
      );
      for (let n = 0; n < 3; n++)
        colors.push(c.r * (n === 2 ? 1.3 : 1), c.g * (n === 2 ? 1.3 : 1), c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    m.onBeforeCompile = (s) => {
      s.uniforms.uWind = { value: 0 };
      m.userData.shader = s;
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uWind;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.x+=sin(position.z*2.+position.x+uWind)*position.y*.18;",
        );
    };
    return m;
  }, []);
  useFrame(({ clock }) => {
    if (material.userData.shader)
      material.userData.shader.uniforms.uWind.value = clock.elapsedTime;
  });
  return <mesh geometry={geom} material={material} receiveShadow />;
}
function HouseDetails() {
  return (
    <>
      <Tea p={[8, 1.15, 3]} />
      <Tea p={[7.15, 1.15, 2.4]} />
      <Tea p={[-8.4, 0.83, 4]} />
      <Paper p={[0, 1.07, 5]} rot={-0.1} />
      <Paper p={[-9, 1.18, -7]} rot={0.08} />
      <Paper p={[7, 1.2, -7]} rot={0.08} />
      <Candle p={[-8.9, 0.83, 4]} />
      <Candle p={[0.9, 1.07, 5]} />
      <group position={[10, 1.43, -2]}>
        <Sphere p={[0, 0.2, 0]} s={[0.25, 0.22, 0.23]} color="#b3c6b8" />
        <Cylinder p={[0, 0.4, 0]} r={0.13} h={0.035} color={brass} />
        <Cable
          points={[
            [0.15, 0.18, 0],
            [0.36, 0.25, 0],
            [0.38, 0.35, 0],
          ]}
          color="#b3c6b8"
          radius={0.055}
        />
        <Ring
          p={[-0.23, 0.23, 0]}
          r={0.15}
          t={0.04}
          rot={[Math.PI / 2, 0, Math.PI / 2]}
          color="#b3c6b8"
        />
      </group>
      {[-1, 1].map((x) => (
        <group key={x}>
          <Sphere
            p={[10 + x * 0.6, 0.75, -0.93]}
            s={[0.038, 0.038, 0.038]}
            color={brass}
          />
          <Box
            p={[10 + x * 0.6, 0.95, -0.94]}
            s={[0.8, 0.026, 0.01]}
            color={brass}
          />
        </group>
      ))}
      <Chandelier p={[0, 4.3, -1.5]} />
      {[-8, -4, 4, 8].map((x) => (
        <group key={x}>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Cable
                points={[
                  [x + side * 1.22, 3.4, -10.1],
                  [x + side * 1.3, 2.5, -10.02],
                  [x + side * 1.05, 1.35, -10.12],
                ]}
                color="#7c7561"
                radius={0.12}
              />
              <Ring
                p={[x + side * 1.23, 2, -10.02]}
                r={0.14}
                t={0.018}
                rot={[0, Math.PI / 2, 0]}
              />
            </group>
          ))}
        </group>
      ))}
    </>
  );
}
function LoftDetails() {
  return (
    <>
      <Chandelier p={[0, 4.8, -3]} />
      {[
        [-8, 4],
        [8, 4],
        [-8, -4],
        [8, -4],
        [0, -8],
        [0, 0],
      ].map(([x, z], i) => (
        <group key={i}>
          <Paper p={[x - 0.35, 1.08, z]} rot={i * 0.14} />
          <Tea p={[x + 0.7, 1.08, z + 0.2]} />
          <Box
            p={[x - 0.8, 1.09, z - 0.2]}
            s={[0.3, 0.08, 0.45]}
            color={i % 2 ? "#896157" : "#456d62"}
          />
          <Box
            p={[x - 0.81, 1.15, z - 0.23]}
            s={[0.3, 0.06, 0.45]}
            color="#bba883"
          />
        </group>
      ))}
      <group position={[-10.9, 0, -8.7]} rotation={[0, 0, -0.13]}>
        {[-0.28, 0.28].map((x) => (
          <Cylinder key={x} p={[x, 1.5, 0]} r={0.035} h={3} color={brass} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <Cylinder
            key={i}
            p={[0, 0.2 + i * 0.3, 0]}
            h={0.6}
            r={0.024}
            rot={[0, 0, Math.PI / 2]}
            color={brass}
          />
        ))}
      </group>
      <group position={[6, 0, -1]}>
        <Box p={[0, 0.42, 0]} s={[1.2, 0.8, 0.85]} color="#665045" />
        <Box
          p={[0, 0.84, -0.15]}
          s={[1.25, 0.07, 0.9]}
          rot={[-0.5, 0, 0]}
          color="#b18e59"
        />
        <Cylinder
          p={[0.75, 0.42, 0]}
          r={0.15}
          h={0.035}
          rot={[0, 0, Math.PI / 2]}
          color={brass}
          metal={0.7}
        />
        <Box p={[0, 0.5, 0.43]} s={[0.16, 0.2, 0.018]} color={brass} />
      </group>
      {[0, 0.6, 1.2].map((r) => (
        <Ring key={r} p={[6, 2, -1]} r={0.59} t={0.008} rot={[r, 0, 0]} />
      ))}
    </>
  );
}
function GardenDetails() {
  return (
    <>
      <Grass />
      <Water />
      {[-1, 1].map((side) => (
        <Cable
          key={side}
          points={Array.from({ length: 13 }, (_, i) => [
            side * 5,
            3.63 - Math.sin((i / 12) * Math.PI) * 0.4,
            7 - i * 1.35,
          ])}
          radius={0.012}
        />
      ))}
      {Array.from({ length: 20 }, (_, i) => (
        <group
          key={i}
          position={[Math.sin(i * 38) * 10, 0.015, -9.7 + i * 0.94]}
          rotation={[0, i, 0]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.09 + (i % 3) * 0.04, 6]} />
            <meshStandardMaterial
              color={i % 2 ? "#b49c73" : "#b47b81"}
              roughness={1}
            />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 10.7, 0, 7.5]}>
          <Cylinder p={[0, 0.7, 0]} r={0.12} h={1.4} color={brass} />
          <Box p={[0, 1.55, 0]} s={[0.48, 0.55, 0.48]} color="#435b4c" />
          {[-1, 1].map((z) => (
            <Box
              key={z}
              p={[0, 1.56, z * 0.25]}
              s={[0.34, 0.37, 0.01]}
              color="#ffd595"
              emissive="#f6ad53"
            />
          ))}
        </group>
      ))}
    </>
  );
}
function LabDetails() {
  const coils = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (coils.current) coils.current.rotation.y = clock.elapsedTime * 0.25;
  });
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s}>
          {Array.from({ length: 8 }, (_, i) => (
            <Ring key={i} p={[s * 4.6, 0.5 + i * 0.22, 0]} r={0.82} t={0.022} />
          ))}
          <mesh position={[s * 4.6, 1.3, 0]}>
            <cylinderGeometry args={[0.37, 0.37, 1.8, 32]} />
            <meshStandardMaterial
              color="#aee9d9"
              emissive="#5dd8bf"
              emissiveIntensity={1.5}
            />
          </mesh>
          <Cable
            points={[
              [s * 4.6, 2.5, 0],
              [s * 4.6, 3, -3],
              [s * 2, 3.3, -7],
              [s * 2, 1.7, -6.5],
            ]}
            color={brass}
            radius={0.032}
          />
        </group>
      ))}
      <CircuitPanel x={-8} />
      <CircuitPanel x={8} />
      <group ref={coils} position={[0, 3.5, -6]}>
        {[0, 1, 2].map((i) => (
          <Ring
            key={i}
            r={0.65 + i * 0.15}
            t={0.021}
            rot={[i * 0.55, 0.4, 0]}
          />
        ))}
      </group>
      {[-8, 8].flatMap((x) =>
        [-5, 5].map((z) => (
          <group key={`${x}${z}`}>
            <Paper p={[x - 0.6, 1.13, z]} />
            <Cable
              points={[
                [x, 1.14, z],
                [x - 0.6, 1.16, z + 0.3],
                [x - 1, 1.14, z + 0.2],
              ]}
              radius={0.018}
            />
            {[-0.2, 0, 0.2].map((a) => (
              <Sphere
                key={a}
                p={[x + 0.7 + a, 1.23, z + 0.28]}
                s={[0.025, 0.025, 0.025]}
                color={a === 0 ? "#ddad67" : "#90a997"}
              />
            ))}
          </group>
        )),
      )}
    </>
  );
}
function MirrorPedestal({ x, rose }: { x: number; rose: boolean }) {
  const glass = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (glass.current)
      glass.current.rotation.z = Math.sin(clock.elapsedTime * 0.35) * 0.035;
  });
  const accent = rose ? "#d8a1ad" : "#83cdb3";
  return (
    <group position={[x, 0, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.48, 0.52, 0.48]} position={[0, 0.52, 0]} />
      </RigidBody>
      <Cylinder p={[0, 0.08, 0]} r={0.56} h={0.16} color="#49615d" />
      <Cylinder p={[0, 0.18, 0]} r={0.48} h={0.06} color={brass} metal={0.7} />
      <Cylinder p={[0, 0.65, 0]} r={0.11} h={0.9} color={brass} metal={0.7} />
      <group rotation={[-0.18, 0, 0]} position={[0, 1.7, 0]}>
        <mesh ref={glass}>
          <circleGeometry args={[0.73, 64]} />
          <meshPhysicalMaterial
            color={accent}
            metalness={1}
            roughness={0.075}
            clearcoat={1}
            side={THREE.DoubleSide}
          />
        </mesh>
        <Ring r={0.77} t={0.033} rot={[0, 0, 0]} />
        <Ring r={0.82} t={0.011} rot={[0, 0, 0]} color={accent} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <Box
              key={i}
              p={[Math.sin(a) * 0.68, Math.cos(a) * 0.68, 0.016]}
              s={[0.012, 0.055, 0.012]}
              rot={[0, 0, -a]}
              color={brass}
            />
          );
        })}
        <Sphere
          p={[0, 0, 0.02]}
          s={[0.045, 0.045, 0.018]}
          color={accent}
          emissive={accent}
        />
        <Box p={[0, 0.22, 0.03]} s={[0.014, 0.43, 0.018]} color={brass} />
      </group>
      <Sphere
        p={[0, 2.6, 0]}
        s={[0.08, 0.08, 0.08]}
        color={accent}
        emissive={accent}
      />
    </group>
  );
}
function CircuitPanel({ x }: { x: number }) {
  const color = x < 0 ? "#83cdb3" : "#d8a1ad";
  return (
    <group position={[x, 1.16, -5.05]} rotation={[-0.28, 0, 0]}>
      <Box p={[0, 0.43, 0]} s={[1.9, 1.1, 0.13]} color="#304e49" />
      <Box p={[0, 0.43, 0.074]} s={[1.72, 0.94, 0.02]} color="#233531" />
      {Array.from({ length: 16 }, (_, i) => {
        const xx = ((i % 4) - 1.5) * 0.36,
          yy = (1.5 - Math.floor(i / 4)) * 0.2 + 0.43;
        return (
          <group key={i} position={[xx, yy, 0.12]}>
            <Ring r={0.065} t={0.017} rot={[0, 0, 0]} />
            <Box p={[0.11, 0, 0]} s={[0.14, 0.018, 0.018]} color={brass} />
            <Sphere
              p={[0, 0, 0.025]}
              s={[0.025, 0.025, 0.012]}
              color={color}
              emissive={color}
            />
          </group>
        );
      })}
      {[-1, 1].map((side) => (
        <Sphere
          key={side}
          p={[side * 0.86, 0.9, 0.11]}
          s={[0.024, 0.024, 0.015]}
          color={brass}
        />
      ))}
      <Box p={[0, -0.12, 0.12]} s={[0.55, 0.055, 0.22]} color={color} />
    </group>
  );
}
function ObservatoryDetails() {
  const mobile = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (mobile.current) mobile.current.rotation.y = clock.elapsedTime * 0.075;
  });
  return (
    <>
      <Aurora />
      <MirrorPedestal x={-6} rose={false} />
      <MirrorPedestal x={6} rose />
      <group ref={mobile} position={[0, 4.5, -5]}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4,
            r = 2 + i * 0.27;
          return (
            <group key={i}>
              <Cable
                points={[
                  [0, 2, 0],
                  [Math.sin(a) * r, 1, Math.cos(a) * r],
                  [Math.sin(a) * r, 0, Math.cos(a) * r],
                ]}
                color={brass}
                radius={0.006}
              />
              <mesh position={[Math.sin(a) * r, 0, Math.cos(a) * r]}>
                <sphereGeometry args={[0.1 + (i % 3) * 0.075, 24, 16]} />
                <meshStandardMaterial
                  color={["#ac9669", "#a7b8b1", "#c79883", "#678e8b"][i % 4]}
                  roughness={0.45}
                />
              </mesh>
            </group>
          );
        })}
      </group>
      {[-1, 1].map((s) => (
        <Cable
          key={s}
          points={Array.from({ length: 25 }, (_, i) => [
            Math.cos((i / 24) * Math.PI) * 11,
            Math.sin((i / 24) * Math.PI) * 8,
            -8 + s * 0.6,
          ])}
          color={brass}
          radius={0.055}
        />
      ))}
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12;
        return (
          <Box
            key={i}
            p={[Math.sin(a) * 4.65, 0.1, -2 + Math.cos(a) * 4.65]}
            s={[0.022, 0.007, i % 3 === 0 ? 0.28 : 0.13]}
            rot={[0, a, 0]}
            color={brass}
          />
        );
      })}
      {[-8, 8].map((x) => (
        <Paper key={x} p={[x, 1.18, 4]} rot={x * 0.04} />
      ))}
    </>
  );
}
export function Details({ place }: { place: Place }) {
  return (
    <group>
      <NightLandscape dream={place === "dream"} />
      <LightShafts place={place} />
      {place !== "dream" && <Rugs place={place} />}{" "}
      {place === "house" ? (
        <HouseDetails />
      ) : place === "loft" ? (
        <LoftDetails />
      ) : place === "garden" ? (
        <GardenDetails />
      ) : place === "lab" ? (
        <LabDetails />
      ) : place === "observatory" ? (
        <ObservatoryDetails />
      ) : null}
    </group>
  );
}
