import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { Box, Cylinder, Sphere, Plant } from "./Primitives";
import { session } from "../network/session";
import { dreamRoutes, dreamGlyphs, dreamTile } from "./adventure";
import { Aurora, Water } from "./Atmosphere";
export function DreamTiles() {
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot),
    round = Math.min(s.state?.dreamRound || 0, 2),
    step = s.state?.dreamStep || 0;
  return (
    <group>
      {dreamGlyphs.map((name, i) => {
        const p = dreamTile(i),
          done = dreamRoutes[round].slice(0, step).includes(i);
        return (
          <group key={i} position={[p.x, 0.035, p.z]}>
            <Box
              s={[1.47, 0.07, 1.47]}
              color={done ? "#809e89" : i % 2 ? "#61716d" : "#b7ac96"}
              metal={0.12}
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.042, 0]}>
              <ringGeometry args={[0.54, 0.55, 40]} />
              <meshStandardMaterial color="#d9bc82" metalness={0.5} />
            </mesh>
            <Text
              font="/fonts/dm-sans-600.ttf"
              position={[0, 0.09, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.15}
              color={done ? "#efffcf" : "#ede6cb"}
              anchorX="center"
              anchorY="middle"
            >
              {name}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
function FloatingFish() {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (root.current) {
      root.current.position.set(
        Math.sin(clock.elapsedTime * 0.13) * 9,
        4.6 + Math.sin(clock.elapsedTime * 0.4) * 0.5,
        -5 + Math.cos(clock.elapsedTime * 0.13) * 3,
      );
      root.current.rotation.y = clock.elapsedTime * 0.13 + Math.PI / 2;
    }
  });
  return (
    <group ref={root} scale={2}>
      <Sphere p={[0, 0, 0]} s={[0.3, 0.42, 0.9]} color="#b7c9bc" />
      <mesh
        position={[0, 0, -0.9]}
        rotation={[0, 0, Math.PI / 4]}
        scale={[0.18, 0.43, 0.4]}
      >
        <octahedronGeometry />
        <meshStandardMaterial color="#b8a0a8" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.24, 0.13, 0.5]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial color="#202c2c" roughness={0.1} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0]} scale={[0.31, 0.44, 0.92]}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshPhysicalMaterial
          color="#c5e3cd"
          transparent
          opacity={0.12}
          roughness={0.18}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}
export function DreamEnvironment() {
  const mobile = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (mobile.current) {
      mobile.current.rotation.y = clock.elapsedTime * 0.06;
      mobile.current.position.y = 5.4 + Math.sin(clock.elapsedTime * 0.3) * 0.3;
    }
  });
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.7, 1.6, 1.7]} position={[8, 1.6, 4]} />
        <CuboidCollider args={[1.25, 0.7, 0.7]} position={[-8, 0.7, 5]} />
        <CuboidCollider args={[1.5, 0.27, 1]} position={[-8, 0.27, -5]} />
      </RigidBody>
      <Aurora />
      <FloatingFish />
      <Cylinder p={[0, 0.005, 0]} r={5.2} h={0.012} color="#a4926e" />
      <Cylinder p={[0, 0.018, 0]} r={5.05} h={0.015} color="#485a59" />
      <group position={[8, 0, 4]} scale={3}>
        <Cylinder p={[0, 0.18, 0]} r={0.8} h={0.12} color="#d6c7aa" />
        <Cylinder p={[0, 0.7, 0]} r={0.61} r2={0.43} h={1.05} color="#b8c6b5" />
        <Water p={[0, 1.235, 0]} radius={0.54} />
        <mesh position={[0.6, 0.74, 0]}>
          <torusGeometry args={[0.33, 0.09, 10, 48]} />
          <meshStandardMaterial color="#b8c6b5" />
        </mesh>
      </group>
      <group position={[-8, 0, 5]}>
        <Box p={[0, 0.7, 0]} s={[2.5, 1.4, 1.4]} color="#58433a" />
        <Box
          p={[0, 1.45, 0]}
          s={[2.8, 0.16, 1.8]}
          color="#dfceb0"
          rot={[0.2, 0, 0]}
        />
        <mesh position={[0, 1.6, 0.06]} rotation={[-Math.PI / 2 + 0.2, 0, 0]}>
          <planeGeometry args={[2.4, 1.5]} />
          <meshStandardMaterial color="#b7c0ac" />
        </mesh>
      </group>
      <group ref={mobile} position={[0, 5.5, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0.3 + i * 0.8, i * 0.5, 0.2]}>
            <torusGeometry args={[3 + i * 0.45, 0.028, 8, 96]} />
            <meshStandardMaterial
              color="#c8a567"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
      {[-1, 1].flatMap((s) =>
        [-8, -2, 5, 9].map((z, i) => (
          <Plant
            key={`${s}${z}`}
            p={[s * (10 + (i % 2)), 0, z]}
            scale={3.5 + (i % 3)}
            flower
          />
        )),
      )}
      <group position={[8, 2, -5]} rotation={[0.15, 0.6, 0.1]}>
        <mesh rotation={[0, 0, Math.PI / 4]} scale={[1.1, 0.18, 1.4]}>
          <octahedronGeometry />
          <meshStandardMaterial color="#ded5bd" />
        </mesh>
        <Cylinder p={[0, 1, 0]} r={0.025} h={1.8} color="#9c835c" />
        <mesh position={[0.4, 1.15, 0]}>
          <planeGeometry args={[0.8, 1.1]} />
          <meshStandardMaterial color="#e8dbbf" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <Box p={[-8, 0.25, -5]} s={[3, 0.5, 2]} color="#7f6260" />
      <Box p={[-8, 0.52, -5]} s={[2.8, 0.06, 1.9]} color="#d5c5a2" />
    </>
  );
}
