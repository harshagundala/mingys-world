import { Cinema, StudioEnvironment } from "./Atmosphere";
import { DreamTiles } from "./Dream";
import {
  memo,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, ContactShadows, Stars, Sparkles } from "@react-three/drei";
import {
  Physics,
  RigidBody,
  CapsuleCollider,
  CuboidCollider,
  useRapier,
} from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { Puppy } from "./Puppy";
import { Environment, PhotoFrame, Box, Table } from "./Environment";
import { clues, fuses } from "./content";
import type { Clue, Place } from "./content";
import { controls } from "./controls";
import { session } from "../network/session";
import { CameraTile } from "../components/CameraTile";
const vec = new THREE.Vector3();
function Character({ onNear }: { onNear: (id: string | null) => void }) {
  const body = useRef<RapierRigidBody>(null),
    model = useRef<THREE.Group>(null),
    moving = useRef(false),
    lastSend = useRef(0),
    lastNear = useRef(""),
    lastPlate = useRef(0),
    lastJump = useRef(0),
    lastSweep = useRef(0);
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const { camera } = useThree();
  const { world } = useRapier();
  useEffect(() => {
    if (import.meta.env.DEV)
      (window as any).__mingy.getObstacles = () => {
        const boxes: any[] = [];
        world.forEachCollider((c) => {
          if (!c.parent()?.isFixed()) return;
          const shape: any = c.shape;
          if (shape.halfExtents) {
            const p = c.translation(),
              h = shape.halfExtents;
            if (p.y + h.y > 0.12)
              boxes.push({ x: p.x, z: p.z, hx: h.x, hz: h.z });
          }
        });
        return boxes;
      };
  }, [world]);
  const first = useRef(true),
    barked = useRef(false);
  useEffect(() => {
    const travel = (e: any) => {
      const p = e.detail;
      body.current?.setTranslation({ x: p.x, y: p.y + 0.2, z: p.z }, true);
      body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
      first.current = true;
    };
    session.addEventListener("travel", travel);
    return () => session.removeEventListener("travel", travel);
  }, []);
  useFrame((state, dt) => {
    if (!body.current) return;
    dt = Math.min(dt, 0.05);
    const b = body.current,
      p = b.translation(),
      v = b.linvel();
    const k = controls.keys;
    const canMove = !controls.blocked && s.status === "connected";
    let dx = canMove
      ? (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) -
        (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0) +
        controls.touch.x
      : 0;
    let dz = canMove
      ? (k.has("ArrowDown") || k.has("KeyS") ? 1 : 0) -
        (k.has("ArrowUp") || k.has("KeyW") ? 1 : 0) +
        controls.touch.z
      : 0;
    const directionX =
      dx * Math.cos(controls.azimuth) + dz * Math.sin(controls.azimuth);
    dz = dz * Math.cos(controls.azimuth) - dx * Math.sin(controls.azimuth);
    dx = directionX;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    moving.current = len > 0.05;
    const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? 5.2 : 3.25;
    b.setLinvel(
      {
        x: THREE.MathUtils.damp(v.x, dx * speed, 18, dt),
        y: v.y,
        z: THREE.MathUtils.damp(v.z, dz * speed, 18, dt),
      },
      true,
    );
    const t = performance.now();
    if (controls.jumpQueued) {
      controls.jumpQueued = false;
      if (canMove && Math.abs(v.y) < 0.22 && t - lastJump.current > 500) {
        b.setLinvel({ x: dx * speed, y: 5.1, z: dz * speed }, true);
        lastJump.current = t;
      }
    }
    if (model.current && moving.current) {
      const angle = Math.atan2(dx, dz);
      model.current.rotation.y +=
        Math.atan2(
          Math.sin(angle - model.current.rotation.y),
          Math.cos(angle - model.current.rotation.y),
        ) * Math.min(1, dt * 13);
    }
    if (p.y < -3 || !Number.isFinite(p.y)) {
      b.setTranslation({ x: 0, y: 1, z: 8 }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (
      s.place === "lab" &&
      s.state?.chapter === 5 &&
      s.state.powerUntil &&
      s.state.powerUntil > Date.now()
    ) {
      const sweep = Math.sin(Date.now() / 2300) * 8;
      if (
        Math.abs(p.z - sweep) < 0.3 &&
        p.y < 0.65 &&
        Math.abs(p.x) > 2 &&
        t - lastSweep.current > 700
      ) {
        lastSweep.current = t;
        b.applyImpulse({ x: p.x > 0 ? -0.16 : 0.16, y: 0.16, z: 0.32 }, true);
      }
    }
    const camHeight = 6.9 * controls.zoom,
      camZ = 8.5 * controls.zoom;
    const target = new THREE.Vector3(
      p.x + Math.sin(controls.azimuth) * camZ,
      p.y + camHeight,
      p.z + Math.cos(controls.azimuth) * camZ,
    );
    if (first.current) {
      camera.position.copy(target);
      first.current = false;
    } else camera.position.lerp(target, 1 - Math.exp(-dt * 4));
    camera.lookAt(p.x, p.y + 0.4, p.z - 1.3);
    if (t - lastSend.current > 65) {
      lastSend.current = t;
      session.move({
        place: s.place,
        x: p.x,
        y: p.y,
        z: p.z,
        rot: model.current?.rotation.y || 0,
        moving: moving.current,
        time: Date.now(),
      });
      let nearest = "",
        distance = Infinity;
      for (const c of clues) {
        // Keep the timed run focused on live fuses, without old notes taking the E prompt.
        if (
          s.place === "lab" &&
          s.state?.chapter === 5 &&
          (s.state.powerUntil || 0) > Date.now() &&
          c.kind !== "portal" &&
          c.id !== "power"
        )
          continue;
        if (
          c.place !== s.place ||
          (c.chapter > (s.state?.chapter || 0) && c.kind !== "portal") ||
          (c.kind === "ball" && s.state?.balls.includes(c.id))
        )
          continue;
        if (
          c.id.startsWith("circuit-") &&
          (s.state?.chapter !== 4 || s.state.round < 3)
        )
          continue;
        if (
          c.id.startsWith("mirror-") &&
          (s.state?.chapter !== 6 || !s.state.skyAligned)
        )
          continue;
        if (c.id.startsWith("dream-tile-") && s.state?.chapter !== 2) continue;
        const d = Math.hypot(p.x - c.pos[0], p.z - c.pos[2]);
        const score =
          d +
          (c.kind === "portal" &&
          (c.chapter > (s.state?.chapter || 0) ||
            (c.gate === "archive" && !s.state?.archiveOpen))
            ? 1.2
            : 0);
        if (d < 2.65 && score < distance) {
          distance = score;
          nearest = c.id;
        }
      }
      if (
        s.place === "lab" &&
        s.state?.chapter === 5 &&
        s.state.powerUntil &&
        s.state.powerUntil > Date.now()
      )
        for (const f of fuses) {
          if (f.role !== s.role || s.state.fuses.includes(f.id)) continue;
          const d = Math.hypot(p.x - f.x, p.z - f.z);
          if (d <= distance + 0.1 && d < 2.2) {
            distance = d;
            nearest = f.id;
          }
        }
      if (nearest !== lastNear.current) {
        lastNear.current = nearest;
        onNear(nearest || null);
      }
    }
    if (
      s.state?.chapter === 3 &&
      s.state.water &&
      s.place === "garden" &&
      t - lastPlate.current > 700
    ) {
      lastPlate.current = t;
      session.action({ kind: "plate" });
    }
  });
  return (
    <RigidBody
      ref={body}
      position={[session.local.x, session.local.y + 0.2, session.local.z]}
      colliders={false}
      enabledRotations={[false, false, false]}
      mass={2}
      linearDamping={0.5}
      friction={0}
      restitution={0}
      ccd
    >
      <CapsuleCollider args={[0.22, 0.27]} position={[0, 0.51, 0]} />
      <ScentPulse role={s.role} />
      <group ref={model}>
        <Puppy role={s.role} moving={() => moving.current} />
      </group>
      <Html position={[0, 2.13, 0]} center zIndexRange={[25, 0]}>
        <CameraTile local role={s.role} />
      </Html>
    </RigidBody>
  );
}
function ScentPulse({ role }: { role: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ring.current) return;
    const left = (controls.sniffUntil - performance.now()) / 1000;
    ring.current.visible = left > 0;
    const radius = 0.6 + (5 - left) * 1.35;
    ring.current.scale.setScalar(radius);
    (ring.current.material as THREE.MeshBasicMaterial).opacity =
      Math.max(0, left / 5) * 0.45;
  });
  return (
    <mesh
      ref={ring}
      position={[0, 0.04, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
    >
      <ringGeometry args={[0.97, 1, 72]} />
      <meshBasicMaterial
        color={role === 0 ? "#b7efd4" : "#ffd1df"}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}
function Partner() {
  const group = useRef<THREE.Group>(null),
    s = useSyncExternalStore(session.subscribe, session.getSnapshot),
    moving = useRef(false);
  const [same, setSame] = useState(true);
  useFrame((_, dt) => {
    const p = session.poses[1 - s.role];
    if (!p || !group.current) return;
    const isSame = p.place === s.place && s.otherOnline;
    if (isSame !== same) setSame(isSame);
    if (!isSame) return;
    moving.current = p.moving && Date.now() - session.lastRemote < 300;
    const v = new THREE.Vector3(p.x, p.y, p.z);
    if (group.current.position.distanceTo(v) > 8)
      group.current.position.copy(v);
    else group.current.position.lerp(v, 1 - Math.exp(-Math.min(dt, 0.1) * 16));
    group.current.rotation.y +=
      Math.atan2(
        Math.sin(p.rot - group.current.rotation.y),
        Math.cos(p.rot - group.current.rotation.y),
      ) * Math.min(1, dt * 15);
  });
  return (
    <group ref={group} visible={same && s.otherOnline} position={[0.8, 0, 8]}>
      <Puppy role={1 - s.role} moving={() => moving.current} />
      {s.otherOnline && same && (
        <Html position={[0, 2.13, 0]} center zIndexRange={[24, 0]}>
          <CameraTile role={1 - s.role} />
        </Html>
      )}
    </group>
  );
}
function Item({
  clue: c,
  onInspect,
  chapter,
  found,
}: {
  clue: Clue;
  onInspect: (id: string) => void;
  chapter: number;
  found: boolean;
}) {
  const marker = useRef<THREE.Mesh>(null),
    group = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false),
    [label, setLabel] = useState(false);
  const active = c.chapter <= chapter;
  useFrame(({ clock }) => {
    if (marker.current) {
      marker.current.position.y =
        c.pos[1] + 0.65 + Math.sin(clock.elapsedTime * 2 + c.pos[0]) * 0.07;
      marker.current.rotation.y = clock.elapsedTime * 0.7;
      marker.current.visible =
        active && (controls.sniffUntil > performance.now() || near || !found);
    }
    const d = Math.hypot(
      session.local.x - c.pos[0],
      session.local.z - c.pos[2],
    );
    if (d < 3 !== near) setNear(d < 3);
    const show =
      d < 3 || (controls.sniffUntil > performance.now() && d < 8 && active);
    if (show !== label) setLabel(show);
  });
  if (!active && c.kind !== "portal") return null;
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        if (near) onInspect(c.id);
      }}
    >
      {c.id === "clock" && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            position={[c.pos[0], 1.4, c.pos[2]]}
            args={[0.53, 1.4, 0.32]}
          />
        </RigidBody>
      )}
      {c.kind === "photo" ? (
        <group position={c.pos}>
          <Suspense fallback={null}>
            <PhotoFrame photo={c.photo} />
          </Suspense>
        </group>
      ) : c.kind === "ball" ? (
        <mesh position={c.pos} castShadow>
          <sphereGeometry args={[0.17, 20, 16]} />
          <meshStandardMaterial color="#c5d64a" roughness={1} />
        </mesh>
      ) : c.kind === "portal" ? (
        <group position={c.pos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
            <ringGeometry args={[0.7, 0.78, 48]} />
            <meshStandardMaterial
              color={active ? "#c5deb3" : "#798679"}
              emissive={active ? "#86bda3" : "#000"}
              emissiveIntensity={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Box
            p={[0, 0.07, 0]}
            s={[1, 0.08, 0.65]}
            color={active ? "#607d69" : "#636153"}
          />
        </group>
      ) : c.id === "clock" ? (
        <group position={c.pos}>
          <Box p={[0, 0.35, 0]} s={[1.05, 2.7, 0.6]} color="#553728" />
          <Box p={[0, 1.87, 0]} s={[1.24, 0.24, 0.8]} color="#b79764" />
          <mesh position={[0, 1.12, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.035, 48]} />
            <meshStandardMaterial color="#decfac" />
          </mesh>
          <Box p={[0, 1.24, 0.36]} s={[0.025, 0.27, 0.02]} color="#4e4036" />
          <Box p={[0.1, 1.12, 0.36]} s={[0.23, 0.025, 0.02]} color="#4e4036" />
          <mesh position={[0, 0.15, 0.35]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#c29d4f" metalness={0.5} />
          </mesh>
        </group>
      ) : c.id === "heart" ? (
        <group position={c.pos}>
          <mesh>
            <octahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial
              color="#f0d796"
              emissive="#dfb562"
              emissiveIntensity={0.9}
              metalness={0.3}
            />
          </mesh>
          <Sparkles count={18} scale={3} size={3} color="#fbe4a0" speed={0.3} />
        </group>
      ) : c.id === "bell" ? (
        <group position={c.pos}>
          <mesh position={[0, 0.24, 0]}>
            <sphereGeometry
              args={[0.17, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial
              color="#c5a252"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
          <Box p={[0, 0.11, 0]} s={[0.45, 0.1, 0.35]} color="#7d5734" />
        </group>
      ) : c.kind === "puzzle" ? null : (
        <group position={c.pos}>
          <Box
            p={[0, 0.09, 0]}
            s={[0.62, 0.035, 0.45]}
            color="#e7d9b8"
            rot={[-0.1, 0.22, 0]}
          />
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              p={[-0.015, 0.116, -0.12 + i * 0.09]}
              s={[0.4, 0.004, 0.008]}
              color="#817b69"
            />
          ))}
        </group>
      )}
      <mesh ref={marker} position={[c.pos[0], c.pos[1] + 0.7, c.pos[2]]}>
        <octahedronGeometry args={[0.095, 0]} />
        <meshBasicMaterial
          color={found ? "#9ad0b5" : active ? "#f2d990" : "#819086"}
        />
      </mesh>
      {label && (
        <Html
          position={[c.pos[0], c.pos[1] + 1.04, c.pos[2]]}
          center
          zIndexRange={[15, 0]}
        >
          <span className="world-label">
            {c.kind === "portal" && !active ? "Not open yet" : c.title}
          </span>
        </Html>
      )}
    </group>
  );
}
function FuseObjects() {
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (beam.current) beam.current.position.z = Math.sin(Date.now() / 2300) * 8;
  });
  if (s.place !== "lab" || s.state?.chapter !== 5) return null;
  const active = !!s.state.powerUntil && s.state.powerUntil > Date.now();
  return (
    <>
      {fuses
        .filter((f) => !s.state?.fuses.includes(f.id))
        .map((f) => (
          <group key={f.id} position={[f.x, 0.6, f.z]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.12, 0.12, 0.52, 16]} />
              <meshStandardMaterial
                color={f.role === 0 ? "#8cddbd" : "#f2a7bf"}
                emissive={f.role === 0 ? "#4c9274" : "#ad6384"}
                emissiveIntensity={active ? 1.3 : 0.15}
              />
            </mesh>
            <mesh position={[0, -0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.4, 0.45, 32]} />
              <meshBasicMaterial color={f.role === 0 ? "#8cddbd" : "#f2a7bf"} />
            </mesh>
          </group>
        ))}
      {active && (
        <mesh ref={beam} position={[0, 0.28, 0]}>
          <boxGeometry args={[21, 0.11, 0.12]} />
          <meshStandardMaterial
            color="#f7a19a"
            emissive="#ff5d52"
            emissiveIntensity={2}
          />
        </mesh>
      )}
    </>
  );
}
function Scene({
  onNear,
  onInspect,
}: {
  onNear: (id: string | null) => void;
  onInspect: (id: string) => void;
}) {
  const s = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const place = s.place as Place;
  return (
    <>
      <color
        attach="background"
        args={[place === "garden" ? "#1b3634" : "#182c2e"]}
      />
      <fog attach="fog" args={["#182c2e", 30, 65]} />
      <StudioEnvironment />
      <ambientLight intensity={0.32} />
      <hemisphereLight args={["#b9d3d5", "#76563e", 0.9]} />
      <directionalLight
        position={[-6, 14, 8]}
        intensity={1.9}
        color="#ffe0ad"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[7, 7, -7]} intensity={1.0} color="#9bbfdb" />
      <Stars radius={70} depth={30} count={500} factor={2} fade speed={0.2} />
      <Sparkles
        count={place === "garden" || place === "dream" ? 100 : 40}
        scale={[24, 5, 22]}
        position={[0, 2, 0]}
        size={2.1}
        speed={0.12}
        color="#e5cf92"
      />
      <Physics
        gravity={[0, place === "dream" ? -8.5 : -13.5, 0]}
        timeStep={1 / 60}
      >
        <Environment key={`env-${place}`} place={place} />
        <Character key={`puppy-${place}`} onNear={onNear} />
        <Partner />
        {place === "dream" && <DreamTiles />}
        {clues
          .filter(
            (c) =>
              c.place === place &&
              !c.id.startsWith("dream-tile-") &&
              (!c.id.startsWith("circuit-") ||
                (s.state?.chapter === 4 && s.state.round === 3)) &&
              (!c.id.startsWith("mirror-") ||
                (s.state?.chapter === 6 && s.state.skyAligned)) &&
              !(c.kind === "ball" && s.state?.balls.includes(c.id)),
          )
          .map((c) => (
            <Item
              key={c.id}
              clue={c}
              onInspect={onInspect}
              chapter={
                c.gate === "archive" && !s.state?.archiveOpen
                  ? -1
                  : s.state?.chapter || 0
              }
              found={!!s.state?.found.includes(c.id)}
            />
          ))}
        <FuseObjects />
      </Physics>
      <Cinema />
    </>
  );
}
function World(props: {
  onNear: (id: string | null) => void;
  onInspect: (id: string) => void;
}) {
  const [quality, setQuality] = useState(1.5);
  useEffect(() => {
    const wheel = (e: WheelEvent) => {
      if (controls.blocked) return;
      controls.zoom = THREE.MathUtils.clamp(
        controls.zoom + e.deltaY * 0.0007,
        0.68,
        1.4,
      );
    };
    window.addEventListener("wheel", wheel, { passive: true });
    return () => window.removeEventListener("wheel", wheel);
  }, []);
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, quality]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 10, 15], fov: 48, near: 0.1, far: 150 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.04;
      }}
    >
      <Suspense
        fallback={
          <Html center>
            <div className="loading-world">
              <i />
              <span>Waking up the house…</span>
            </div>
          </Html>
        }
      >
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}

export default memo(World);
