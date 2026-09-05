import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
export function Puppy({
  role = 0,
  moving = false,
  scale = 1.0,
}: {
  role?: number;
  moving?: boolean | (() => boolean);
  scale?: number;
}) {
  const { scene } = useGLTF("/models/puppy.glb");
  const model = useMemo(() => {
    const m = clone(scene);
    m.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material.name === "Collar") {
          o.material = o.material.clone();
          o.material.color.set(role === 0 ? "#428e7a" : "#bd627f");
        }
      }
    });
    return m;
  }, [scene, role]);
  const bones = useMemo(
    () =>
      Object.fromEntries(
        [
          "FrontL",
          "FrontR",
          "BackL",
          "BackR",
          "Tail",
          "Head",
          "EarL",
          "EarR",
        ].map((n) => [n, model.getObjectByName(n)]),
      ),
    [model],
  );
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime,
      w = typeof moving === "function" ? moving() : moving;
    const speed = w ? 11 : 2;
    for (const [i, n] of ["FrontL", "FrontR", "BackL", "BackR"].entries()) {
      const b = bones[n];
      if (b)
        b.rotation.x = w
          ? Math.sin(t * speed + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.43
          : 0;
    }
    if (bones.Tail) bones.Tail.rotation.z = Math.sin(t * (w ? 12 : 6)) * 0.26;
    if (bones.Head) bones.Head.rotation.y = Math.sin(t * 1.2) * 0.055;
    if (bones.EarL) bones.EarL.rotation.x = w ? Math.sin(t * 11) * 0.13 : 0;
    if (bones.EarR)
      bones.EarR.rotation.x = w ? Math.sin(t * 11 + 0.8) * 0.13 : 0;
    if (body.current)
      body.current.position.y = w
        ? Math.abs(Math.sin(t * 11)) * 0.025
        : Math.sin(t * 2) * 0.007;
  });
  return (
    <group ref={body} scale={scale}>
      <primitive object={model} />
      {role === 1 && (
        <group position={[0.29, 1.18, 0.42]} rotation={[0.2, 0, -0.35]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 0.057, 0, 0]}
              scale={[0.068, 0.042, 0.03]}
              rotation={[0, 0, side * 0.4]}
            >
              <sphereGeometry args={[1, 16, 12]} />
              <meshStandardMaterial color="#c66d8b" />
            </mesh>
          ))}
          <mesh scale={[0.022, 0.023, 0.028]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#e1a0b6" />
          </mesh>
        </group>
      )}
    </group>
  );
}
useGLTF.preload("/models/puppy.glb");
