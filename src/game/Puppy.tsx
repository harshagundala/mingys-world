import { useGLTF } from "@react-three/drei";
import { createPortal, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { addFur, addSurfaceDetail } from "./Fur";
export function Puppy({
  role = 0,
  moving = false,
  scale = 1,
}: {
  role?: number;
  moving?: boolean | (() => boolean);
  scale?: number;
}) {
  const { scene } = useGLTF("/models/puppy-v4.glb");
  const { model, owned, coats, eyelids } = useMemo(() => {
    const owned: THREE.Material[] = [];
    const coats: ReturnType<typeof addFur>[] = [];
    const m = clone(scene);
    const meshes: THREE.Mesh[] = [];
    const eyelids: THREE.Mesh[] = [];
    m.traverse((o: any) => {
      if (o.isMesh) meshes.push(o);
    });
    for (const o of meshes) {
      o.castShadow = true;
      o.receiveShadow = true;
      const mat = o.material as THREE.MeshStandardMaterial;
      if (o.morphTargetDictionary?.Blink !== undefined) eyelids.push(o);
      if (
        ["Eye chocolate", "Amber iris", "Pupil"].includes(mat.name) &&
        o.parent?.name.startsWith("Blink")
      ) {
        const eye = new THREE.MeshPhysicalMaterial({
          color: mat.color,
          vertexColors: mat.vertexColors,
          roughness: 0.16,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          ior: 1.38,
        });
        o.material = eye;
        owned.push(eye);
      }
      if (mat.name === "Nose velvet") {
        const nose = mat.clone();
        nose.roughness = 0.38;
        addSurfaceDetail(nose, o, true);
        o.material = nose;
        owned.push(nose);
      }
      if (mat.name === "Collar") {
        const c = mat.clone();
        c.color.set(role === 0 ? "#377f70" : "#b96885");
        o.material = c;
        owned.push(c);
      }
      if (mat.name.startsWith("Fur")) {
        const c = mat.clone();
        if (role === 1) c.color.lerp(new THREE.Color("#f2d393"), 0.17);
        o.material = c;
        c.roughness = 0.94;
        addSurfaceDetail(c, o);
        owned.push(c);
        coats.push(addFur(o));
      }
    }
    const head = m.getObjectByName("Head");
    if (head) head.scale.multiplyScalar(role === 0 ? 1.035 : 0.965);
    return { model: m, owned, coats, eyelids };
  }, [scene, role]);
  useEffect(
    () => () => {
      owned.forEach((m) => m.dispose());
      coats.forEach((coat) => coat.dispose());
    },
    [owned, coats],
  );
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
          "BlinkL",
          "BlinkR",
          "Jaw",
        ].map((n) => {
          const o = model.getObjectByName(n);
          return [n, { o, rot: o?.rotation.clone(), scale: o?.scale.clone() }];
        }),
      ),
    [model],
  );
  const body = useRef<THREE.Group>(null);
  const walk = useRef(0);
  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime + role * 1.3,
      w = typeof moving === "function" ? moving() : moving;
    walk.current = THREE.MathUtils.damp(walk.current, w ? 1 : 0, 9, dt);
    const blend = walk.current;
    for (const [i, n] of ["FrontL", "FrontR", "BackL", "BackR"].entries()) {
      const { o, rot } = bones[n];
      if (o && rot)
        o.rotation.x =
          rot.x +
          Math.sin(t * 11 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.46 * blend;
    }
    const animate = (n: string, axis: "x" | "y" | "z", v: number) => {
      const b = bones[n];
      if (b?.o && b.rot) b.o.rotation[axis] = b.rot[axis] + v;
    };
    animate("Tail", "z", Math.sin(t * (w ? 12 : 5)) * 0.3);
    animate("Head", "y", Math.sin(t * 1.1) * 0.075 * (1 - blend));
    animate(
      "Head",
      "x",
      Math.sin(t * 2) * 0.02 + Math.sin(t * 11) * 0.045 * blend,
    );
    animate("EarL", "x", Math.sin(t * 11 - 0.45) * 0.2 * blend);
    animate("EarR", "x", Math.sin(t * 11 + 0.3) * 0.2 * blend);
    animate("Jaw", "x", Math.sin(t * 4) * 0.035);
    const blink = Math.max(0, 1 - Math.abs((t % 4.7) - 4.42) / 0.095);
    for (const lid of eyelids) {
      lid.morphTargetInfluences![lid.morphTargetDictionary!.Blink] = blink;
    }
    if (body.current) {
      body.current.position.y =
        Math.abs(Math.sin(t * 11)) * 0.025 * blend +
        Math.sin(t * 2) * 0.009 * (1 - blend);
      body.current.rotation.z = Math.sin(t * 11) * 0.013 * blend;
      body.current.updateWorldMatrix(true, true);
      coats.forEach((coat) => coat.update(dt, camera));
    }
  });
  return (
    <group ref={body} scale={scale}>
      <primitive object={model} />
      {role === 0 && <Bandana />}
      {role === 1 &&
        createPortal(
          <group rotation={[0.3, 0, -0.48]} scale={0.95}>
            {[-1, 1].map((side) => (
              <group
                key={side}
                position={[side * 0.064, 0, 0]}
                rotation={[0, 0, side * 0.35]}
              >
                <mesh scale={[0.078, 0.053, 0.028]}>
                  <sphereGeometry args={[1, 24, 16]} />
                  <meshPhysicalMaterial
                    color="#ba587d"
                    roughness={0.6}
                    sheen={1}
                    sheenColor="#efb1c3"
                  />
                </mesh>
                <mesh
                  position={[side * 0.017, -0.084, 0]}
                  rotation={[0, 0, side * 0.25]}
                  scale={[0.035, 0.067, 0.012]}
                >
                  <sphereGeometry args={[1, 20, 12]} />
                  <meshStandardMaterial color="#c76c8a" />
                </mesh>
              </group>
            ))}
            <mesh scale={[0.028, 0.029, 0.032]}>
              <sphereGeometry args={[1, 20, 12]} />
              <meshStandardMaterial color="#dc97ac" />
            </mesh>
          </group>,
          model.getObjectByName("BowAnchor")!,
        )}
    </group>
  );
}
function Bandana() {
  const geometry = useMemo(() => {
    const vertices: number[] = [],
      indices: number[] = [];
    const rows = 12,
      columns = 16;
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      for (let i = 0; i <= columns; i++) {
        const u = i / columns;
        vertices.push(
          (u * 2 - 1) * 0.19 * (1 - v),
          0.79 - v * 0.35,
          0.63 +
            Math.sin(v * Math.PI) * 0.02 +
            Math.sin(u * Math.PI * 3) * Math.sin(v * Math.PI) * 0.012,
        );
        if (j < rows && i < columns) {
          const a = j * (columns + 1) + i;
          indices.push(
            a,
            a + columns + 1,
            a + 1,
            a + 1,
            a + columns + 1,
            a + columns + 2,
          );
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color="#377f70"
        side={THREE.DoubleSide}
        roughness={0.9}
        sheen={0.65}
        sheenColor="#94bba7"
      />
    </mesh>
  );
}
useGLTF.preload("/models/puppy-v4.glb");
