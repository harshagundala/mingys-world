import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as T from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { State } from "../../server/autumn/rules";
import { net } from "./network";
import { wildlifeHomes, wildlifePlan } from "./wildlifeBehavior";
import type { AnimalSpec, Observer } from "./wildlifeBehavior";

function FallenLeaf({ visible }: { visible: boolean }) {
  const geometry = useMemo(() => {
    const s = new T.Shape();
    s.moveTo(0, -0.06);
    s.bezierCurveTo(-0.1, -0.045, -0.12, 0.045, 0, 0.11);
    s.bezierCurveTo(0.11, 0.045, 0.095, -0.04, 0, -0.06);
    return new T.ShapeGeometry(s, 8);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group
      visible={visible}
      position={[0, 0.435, 0.56]}
      rotation={[-0.55, 0.25, 0.4]}
      scale={0.7}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#c48b42"
          side={T.DoubleSide}
          roughness={0.95}
        />
      </mesh>
      <mesh position={[0, 0.015, 0.001]}>
        <boxGeometry args={[0.004, 0.16, 0.002]} />
        <meshStandardMaterial color="#71502c" />
      </mesh>
    </group>
  );
}
function Animal({
  animal,
  s,
  quality,
}: {
  animal: AnimalSpec;
  s: State;
  quality: string;
}) {
  // These local GLBs contain no compressed extensions. Avoid starting unused
  // Draco/Meshopt decoder machinery on the first visible animal.
  const { scene } = useGLTF(`/models/autumn/${animal.kind}.glb`, false, false);
  const model = useMemo(() => {
    const clone = cloneSkeleton(scene);
    clone.traverse((o) => {
      const mesh = o as T.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
      }
    });
    return clone;
  }, [scene]);
  useEffect(
    () => () => {
      const skeletons = new Set<T.Skeleton>();
      model.traverse((o) => {
        if ((o as T.SkinnedMesh).isSkinnedMesh)
          skeletons.add((o as T.SkinnedMesh).skeleton);
      });
      skeletons.forEach((s) => s.dispose());
    },
    [model],
  );
  const bones = useMemo(
    () =>
      Object.fromEntries(
        [
          "Neck",
          "Head",
          "EarL",
          "EarR",
          "FrontL",
          "FrontR",
          "HindL",
          "HindR",
          "FrontLLower",
          "FrontRLower",
          "HindLLower",
          "HindRLower",
          "Tail",
        ].map((n) => [n, model.getObjectByName(n)]),
      ),
    [model],
  );
  const joint = useMemo(() => {
    const rests = Object.fromEntries(
      Object.entries(bones).map(([name, bone]) => [
        name,
        bone?.quaternion.clone(),
      ]),
    );
    const e = new T.Euler(),
      q = new T.Quaternion();
    return (name: string, x = 0, y = 0, z = 0) => {
      const bone = bones[name],
        rest = rests[name];
      if (bone && rest)
        bone.quaternion.copy(rest).multiply(q.setFromEuler(e.set(x, y, z)));
    };
  }, [bones]);
  const root = useRef<T.Group>(null),
    body = useRef<T.Group>(null),
    leaf = useRef<T.Group>(null);
  const last = useRef(0),
    initialized = useRef(false),
    walk = useRef(0),
    speed = useRef(0),
    graze = useRef(0),
    calm = useRef(0),
    notified = useRef(false);
  const direction = useMemo(() => new T.Vector3(), []);
  useEffect(() => {
    model.traverse((o) => {
      const mesh = o as T.Mesh;
      if (mesh.isMesh) mesh.castShadow = quality !== "low";
    });
  }, [model, quality]);
  useFrame(({ camera }, frameDt) => {
    if (!root.current || !body.current) return;
    const now = (Date.now() + net.clockOffset) / 1000;
    if (now - last.current < (quality === "low" ? 1 / 20 : 1 / 30)) return;
    const dt = Math.min(0.12, Math.max(0.001, now - last.current));
    last.current = now;
    const homeDistance = Math.hypot(
      camera.position.x - animal.x,
      camera.position.z - animal.z,
    );
    root.current.visible = homeDistance < 52;
    if (homeDistance > 57) return;
    const players: Observer[] = [net.local];
    const peer = net.poses[1 - net.snapshot.role];
    if (net.snapshot.peer && peer) players.push(peer);
    const t = now - s.startedAt / 1000,
      plan = wildlifePlan(animal, t, players, s.phase);
    if (!initialized.current) {
      root.current.position.set(plan.x, 0, plan.z);
      root.current.rotation.y = plan.yaw;
      initialized.current = true;
    }
    const oldX = root.current.position.x,
      oldZ = root.current.position.z;
    // Critically damped pursuit produces a continuous retreat instead of a teleport.
    root.current.position.x = T.MathUtils.damp(
      oldX,
      plan.x,
      plan.nervous > 0.1 ? 1.5 : 0.7,
      dt,
    );
    root.current.position.z = T.MathUtils.damp(
      oldZ,
      plan.z,
      plan.nervous > 0.1 ? 1.5 : 0.7,
      dt,
    );
    direction.set(
      root.current.position.x - oldX,
      0,
      root.current.position.z - oldZ,
    );
    const travelled = direction.length();
    speed.current = T.MathUtils.damp(speed.current, travelled / dt, 8, dt);
    const walking = speed.current > 0.07;
    const yaw = walking ? Math.atan2(direction.x, direction.z) : plan.yaw;
    const delta = Math.atan2(
      Math.sin(yaw - root.current.rotation.y),
      Math.cos(yaw - root.current.rotation.y),
    );
    root.current.rotation.y += delta * (1 - Math.exp(-dt * 4));
    walk.current +=
      (travelled * (animal.kind === "deer" ? 7 : 15)) / animal.scale;
    graze.current = T.MathUtils.damp(
      graze.current,
      walking ? 0 : plan.graze,
      2,
      dt,
    );
    calm.current = T.MathUtils.damp(calm.current, plan.curious ? 1 : 0, 1, dt);
    const gait = walk.current,
      breathe = Math.sin(now * 2.2 + animal.id) * 0.003;
    body.current.position.y = breathe;
    if (homeDistance > 30) return;
    if (animal.kind === "deer") {
      const stride = Math.min(0.6, speed.current * 0.42);
      for (const [i, key] of ["FrontL", "FrontR", "HindL", "HindR"].entries()) {
        const leg = bones[key];
        if (!leg) continue;
        const phase = gait + [0, Math.PI, Math.PI * 0.8, Math.PI * 1.8][i];
        joint(key, Math.sin(phase) * stride);
        joint(key + "Lower", Math.max(0, -Math.sin(phase)) * (-stride * 0.8));
      }
      joint(
        "Neck",
        graze.current * 1.5 + Math.sin(now * 0.7 + animal.id) * 0.025,
        Math.sin(now * 0.21 + animal.id) * 0.065,
      );
      body.current.position.y += walking
        ? Math.abs(Math.sin(gait)) * Math.min(0.035, speed.current * 0.018)
        : 0;
    } else {
      const hop = Math.max(0, Math.sin(gait));
      const amount = Math.min(1, speed.current * 2);
      body.current.position.y += hop * 0.14 * amount;
      body.current.rotation.x = Math.sin(gait) * 0.11 * amount;
      for (const key of ["FrontL", "FrontR"])
        joint(key, Math.sin(gait) * 0.45 * amount);
      for (const key of ["HindL", "HindR"])
        joint(key, -Math.sin(gait) * 0.5 * amount);
      joint(
        "Head",
        graze.current * 0.28 + Math.sin(now * 7) * 0.012 * (walking ? 0 : 1),
        Math.sin(now * 0.45 + animal.id) * 0.09,
      );
      if (leaf.current) leaf.current.visible = plan.leaf && calm.current > 0.8;
      if (
        animal.id === 2 &&
        plan.leaf &&
        calm.current > 0.98 &&
        !notified.current
      ) {
        notified.current = true;
        net.event(
          "notice",
          "A tiny neighbour has brought you a leaf. Some company is worth standing still for.",
        );
      }
    }
    // Ears listen independently, with brief irregular flicks rather than a metronomic wave.
    const flick = Math.pow(
      Math.max(0, Math.sin(now * 0.83 + animal.id * 3.4)),
      18,
    );
    joint(
      "EarL",
      Math.sin(now * 0.31 + animal.id) * 0.09,
      0,
      -0.06 - flick * 0.25,
    );
    joint(
      "EarR",
      Math.sin(now * 0.27) * 0.08,
      0,
      0.06 + Math.pow(Math.max(0, Math.sin(now * 0.67 + animal.id)), 20) * 0.22,
    );
    joint(
      "Tail",
      0,
      Math.sin(now * 4 + animal.id) * 0.1 * (plan.nervous + 0.2),
    );
  });
  return (
    <group
      ref={root}
      position={[animal.x, 0, animal.z]}
      scale={animal.scale}
      name={`wildlife-${animal.kind}-${animal.id}`}
    >
      <group ref={body}>
        <primitive object={model} dispose={null} />
        {animal.id === 2 && (
          <group ref={leaf} visible={false}>
            <FallenLeaf visible />
          </group>
        )}
      </group>
    </group>
  );
}
class WildlifeBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Optional wildlife never participates in progression, inventory or collision. */
export function Wildlife({
  s,
  quality = "high",
}: {
  s: State;
  quality?: string;
}) {
  return (
    <WildlifeBoundary>
      <Suspense fallback={null}>
        {wildlifeHomes.map((animal) => (
          <Animal key={animal.id} animal={animal} s={s} quality={quality} />
        ))}
      </Suspense>
    </WildlifeBoundary>
  );
}
