import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as T from "three";
import { Lantern } from "./Models";
function Specimen({ color, shape }: { color: string; shape: number }) {
  const group = useRef<T.Group>(null),
    light = useRef<T.PointLight>(null);
  const reduced = useRef(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useFrame(({ clock }, dt) => {
    if (group.current) {
      group.current.position.y = T.MathUtils.damp(
        group.current.position.y,
        0.18 +
          (!reduced.current ? Math.sin(clock.elapsedTime * 1.2) * 0.025 : 0),
        8,
        dt,
      );
    }
    if (light.current)
      light.current.color.lerp(new T.Color(color), 1 - Math.exp(-dt * 8));
  });
  useEffect(() => {
    if (group.current) group.current.position.y = 0.07;
  }, [shape]);
  return (
    <>
      <group ref={group} position={[0, 0.18, 0]}>
        <Lantern color={color} shape={shape} scale={1.55} />
      </group>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={2.5} color="#ffe4b4" />
      <pointLight
        ref={light}
        position={[0, 1, 0]}
        intensity={2}
        color={color}
      />
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.3}
        scale={5}
        blur={2.5}
        far={3}
        frames={1}
      />
      <OrbitControls
        target={[0, 0.8, 0]}
        enableZoom={false}
        enablePan={false}
        autoRotate={!reduced.current}
        autoRotateSpeed={0.65}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
      />
    </>
  );
}
export default function LanternPreview({
  color,
  shape,
}: {
  color: string;
  shape: number;
}) {
  return (
    <div
      className="ll-lantern-preview"
      aria-label="Your lantern, in three dimensions. Drag to turn it."
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.15, 3], fov: 35 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      >
        <Suspense fallback={null}>
          <Specimen color={color} shape={shape} />
        </Suspense>
      </Canvas>
      <span>Drag to turn</span>
    </div>
  );
}
