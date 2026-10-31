import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Lantern, Produce } from "./Models";
import { input } from "./controls";
import { net } from "./network";
import { toolImpact, throwHandling, harvestHandling } from "./actionMotion";
import { props, rand } from "./content";
import type { Role } from "./content";
import type { State } from "../../server/autumn/rules";
const palette = [
  "#ffbd68",
  "#9ce0cc",
  "#e9a7c8",
  "#a9b9ed",
  "#e6d58f",
  "#e89b78",
];
type Piece = {
  kind?: "round" | "rod" | "box";
  p: number[];
  s: number[];
  color: string;
  r?: number[];
};
function Assembly({
  pieces,
  metal = false,
}: {
  pieces: Piece[];
  metal?: boolean;
}) {
  const geometry = useMemo(() => {
    const matrix = new T.Matrix4(),
      rotation = new T.Quaternion(),
      position = new T.Vector3(),
      scale = new T.Vector3(),
      color = new T.Color();
    const parts = pieces.map((part) => {
      const g =
        part.kind === "round"
          ? new T.SphereGeometry(1, 18, 12)
          : part.kind === "rod"
            ? new T.CylinderGeometry(0.92, 1, 1, 20)
            : new T.BoxGeometry(1, 1, 1);
      position.fromArray(part.p);
      scale.fromArray(part.s);
      rotation.setFromEuler(
        new T.Euler(...((part.r || [0, 0, 0]) as [number, number, number])),
      );
      matrix.compose(position, rotation, scale);
      g.applyMatrix4(matrix);
      color.set(part.color);
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }
      g.setAttribute("color", new T.BufferAttribute(colors, 3));
      return g;
    });
    const out = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    return out;
  }, [pieces]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        vertexColors
        roughness={metal ? 0.3 : 0.82}
        metalness={metal ? 0.65 : 0}
      />
    </mesh>
  );
}
function Hand({
  role,
  left = false,
  opening,
}: {
  role: Role;
  left?: boolean;
  opening?: () => number;
}) {
  const fingers = useRef<T.Group>(null);
  const pieces = useMemo<{ body: Piece[]; fingertips: Piece[] }>(() => {
    const skin = role ? "#ce9672" : "#b37c59",
      cuff = role ? "#bd7753" : "#405e51";
    const all: Piece[] = [
      {
        kind: "round",
        p: [0.026, -0.036, 0.025],
        s: [0.076, 0.074, 0.047],
        color: skin,
      },
      {
        kind: "rod",
        p: [0.037, -0.091, 0.062],
        s: [0.076, 0.052, 0.071],
        color: cuff,
        r: [Math.PI / 3, 0, 0],
      },
      {
        kind: "round",
        p: [-0.035, -0.018, -0.003],
        s: [0.026, 0.044, 0.028],
        color: skin,
        r: [0, 0, -0.55],
      },
    ];
    const fingertips: Piece[] = [];
    for (let i = 0; i < 4; i++) {
      fingertips.push(
        {
          kind: "round",
          p: [0.018 + i * 0.022, -0.001 - i * 0.012, -0.024],
          s: [0.018, 0.038, 0.025],
          color: skin,
          r: [-0.45, 0, 0.1],
        },
        {
          kind: "round",
          p: [0.018 + i * 0.022, 0.018 - i * 0.012, -0.043],
          s: [0.017, 0.016, 0.025],
          color: skin,
        },
      );
    }
    for (let i = 0; i < 7; i++)
      all.push({
        p: [-0.017 + i * 0.017, -0.1, 0.101],
        s: [0.006, 0.004, 0.005],
        color: "#e5d4b0",
      });
    return { body: all, fingertips };
  }, [role]);
  useFrame((_, dt) => {
    if (!fingers.current) return;
    const open = opening?.() || 0;
    fingers.current.rotation.x = T.MathUtils.damp(
      fingers.current.rotation.x,
      -open * 0.55,
      18,
      Math.min(dt, 0.05),
    );
    fingers.current.scale.y = T.MathUtils.damp(
      fingers.current.scale.y,
      1 + open * 0.45,
      18,
      Math.min(dt, 0.05),
    );
  });
  return (
    <group scale={[left ? -1 : 1, 1, 1]}>
      <Assembly pieces={pieces.body} />
      <group ref={fingers}>
        <Assembly pieces={pieces.fingertips} />
      </group>
    </group>
  );
}
const hammerWood: Piece[] = [
  { kind: "rod", p: [0, 0.08, 0], s: [0.025, 0.39, 0.025], color: "#92653d" },
  ...Array.from({ length: 5 }, (_, i) => ({
    kind: "rod" as const,
    p: [0, -0.085 + i * 0.025, 0],
    s: [0.028, 0.012, 0.028],
    color: "#594334",
  })),
];
const hammerMetal: Piece[] = [
  { p: [0, 0.29, 0], s: [0.24, 0.09, 0.095], color: "#7a8583" },
  {
    kind: "rod",
    p: [-0.135, 0.29, 0],
    s: [0.061, 0.045, 0.061],
    r: [0, 0, Math.PI / 2],
    color: "#a6ada6",
  },
  {
    p: [0.14, 0.31, 0],
    s: [0.11, 0.032, 0.085],
    r: [0, 0, 0.3],
    color: "#6d7977",
  },
];
const knifeHandle: Piece[] = [
  { kind: "rod", p: [0, 0.015, 0], s: [0.024, 0.19, 0.027], color: "#73503a" },
  { kind: "rod", p: [0, 0.105, 0], s: [0.03, 0.025, 0.03], color: "#c6b99b" },
];
const knifeMetal: Piece[] = [
  { p: [0.025, 0.235, 0], s: [0.075, 0.25, 0.009], color: "#bcc7c5" },
  { p: [0.058, 0.235, 0], s: [0.01, 0.25, 0.006], color: "#e1e7df" },
];
const spoonPieces: Piece[] = [
  { kind: "rod", p: [0, 0.1, 0], s: [0.014, 0.43, 0.014], color: "#bc935b" },
  { kind: "round", p: [0, 0.34, 0], s: [0.065, 0.09, 0.025], color: "#b48650" },
  {
    kind: "round",
    p: [0, 0.34, 0.018],
    s: [0.048, 0.072, 0.006],
    color: "#957043",
  },
];
const reelGrip: Piece[] = [
  { kind: "rod", p: [0, 0.045, 0], s: [0.024, 0.22, 0.024], color: "#87633e" },
  { p: [0, 0.15, 0], s: [0.19, 0.045, 0.075], color: "#79604a" },
  {
    kind: "rod",
    p: [0, 0.205, 0],
    s: [0.017, 0.18, 0.017],
    r: [Math.PI / 2, 0, 0],
    color: "#a78654",
  },
];
const reelSpool: Piece[] = [
  {
    kind: "rod",
    p: [0, 0, 0],
    s: [0.074, 0.09, 0.074],
    r: [Math.PI / 2, 0, 0],
    color: "#d6c69b",
  },
  {
    kind: "rod",
    p: [0, 0, -0.052],
    s: [0.103, 0.015, 0.103],
    r: [Math.PI / 2, 0, 0],
    color: "#9f7848",
  },
  {
    kind: "rod",
    p: [0, 0, 0.052],
    s: [0.103, 0.015, 0.103],
    r: [Math.PI / 2, 0, 0],
    color: "#9f7848",
  },
  { p: [-0.055, 0, 0.07], s: [0.12, 0.018, 0.018], color: "#c3a566" },
  {
    kind: "rod",
    p: [-0.105, 0, 0.095],
    s: [0.019, 0.05, 0.019],
    r: [Math.PI / 2, 0, 0],
    color: "#654b34",
  },
];
/** Camera-local rig. The parent owns walking sway and camera position. */
export function HeldObjectRig({ s, role }: { s: State; role: Role }) {
  const wrist = useRef<T.Group>(null),
    support = useRef<T.Group>(null),
    normal = useRef<T.Group>(null),
    hammer = useRef<T.Group>(null),
    knife = useRef<T.Group>(null),
    spoon = useRef<T.Group>(null),
    reel = useRef<T.Group>(null),
    wheel = useRef<T.Group>(null),
    object = useRef<T.Group>(null),
    sleeveRight = useRef<T.Mesh>(null),
    sleeveLeft = useRef<T.Mesh>(null);
  const lastTool = useRef({ kind: "", until: 0 }),
    open = useRef(0),
    supportOpen = useRef(0),
    reelTurn = useRef(0);
  const reduced = useMemo(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );
  const line = useMemo(
    () =>
      new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(0, 0.27, -0.04),
          new T.Vector3(-0.05, 0.46, -0.6),
          new T.Vector3(-0.16, 1.05, -2.3),
        ]),
        new T.LineBasicMaterial({
          color: "#dacb9f",
          transparent: true,
          opacity: 0.78,
        }),
      ),
    [],
  );
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  const armVectors = useMemo(
    () => ({
      from: new T.Vector3(),
      to: new T.Vector3(),
      direction: new T.Vector3(),
      up: new T.Vector3(0, 1, 0),
    }),
    [],
  );
  const held = s.bags[role]?.[0] || (s.phase === 5 ? "pumpkin" : "");
  useFrame(({ clock }, delta) => {
    const now = performance.now(),
      dt = Math.min(0.05, delta),
      challenge = s.challenge;
    if (challenge?.role === role)
      lastTool.current = { kind: challenge.kind, until: now + 900 };
    const flying = s.phase === 6 && s.kite?.role === role;
    const tool = flying
      ? "reel"
      : now < lastTool.current.until
        ? lastTool.current.kind
        : "";
    if (hammer.current) hammer.current.visible = tool === "bridge";
    if (knife.current) knife.current.visible = tool === "prep";
    if (spoon.current) spoon.current.visible = tool === "cook";
    if (reel.current) reel.current.visible = flying;
    const age = (Date.now() + net.clockOffset - net.gestureAt) / 1000;
    const heldMs = input.holding ? now - input.holding : 0;
    const throwing = throwHandling(
      net.gesture === "throw" ? age : -1,
      s.phase === 5 ? heldMs : 0,
    );
    const harvest = harvestHandling(
      s.phase === 1 ? heldMs : 0,
      net.gesture === "collect" && s.phase === 1 ? age : -1,
    );
    const impact = net.gesture === "hit" ? toolImpact(age) : 0;
    const reach =
      ["collect", "ingredient", "craft", "place", "serve", "moth"].includes(
        net.gesture,
      ) &&
      age >= 0 &&
      age < 0.7
        ? Math.sin((age / 0.7) * Math.PI)
        : 0;
    const motion = reduced ? 0.35 : 1;
    const wave =
      net.gesture === "wave" && age >= 0 && age < 0.95
        ? Math.sin((Math.min(1, age / 0.18) * Math.PI) / 2) *
          (1 - T.MathUtils.smoothstep(age, 0.68, 0.95))
        : 0;
    open.current =
      s.phase === 5
        ? throwing.open
        : s.phase === 1 && heldMs > 0
          ? 0.42 * (1 - harvest.reach)
          : 0;
    supportOpen.current = wave > 0.01 ? 1 : open.current;
    if (normal.current)
      normal.current.visible = !tool && !(s.phase === 1 && heldMs > 0);
    if (object.current) {
      object.current.visible = s.phase !== 5 || throwing.objectVisible;
      object.current.scale.setScalar(
        s.phase === 5 ? 0.72 + 0.28 * throwing.reveal : 1,
      );
    }
    if (wrist.current) {
      const base =
        tool === "bridge"
          ? -0.32 + impact * 1.08
          : tool === "prep"
            ? -0.35 + impact * 0.75
            : tool === "cook"
              ? 0.12 + Math.sin(clock.elapsedTime * 3) * 0.065 + impact * 0.16
              : flying
                ? -0.12
                : reach * -0.2 + throwing.draw * 0.6 - throwing.follow * 0.78;
      wrist.current.rotation.x = T.MathUtils.damp(
        wrist.current.rotation.x,
        base * motion,
        tool === "bridge" || tool === "prep" ? 30 : 18,
        dt,
      );
      wrist.current.rotation.y = T.MathUtils.damp(
        wrist.current.rotation.y,
        harvest.twist * motion + throwing.follow * 0.16 * motion,
        14,
        dt,
      );
      wrist.current.rotation.z = T.MathUtils.damp(
        wrist.current.rotation.z,
        (tool === "cook"
          ? Math.sin(clock.elapsedTime * 3) * 0.075
          : tool === "prep"
            ? -0.27
            : harvest.twist) * motion,
        14,
        dt,
      );
      wrist.current.position.y = T.MathUtils.damp(
        wrist.current.position.y,
        (!tool
          ? s.hands[role]
            ? 0.34
            : held
              ? 0.11
              : 0.22
          : flying
            ? 0.04
            : 0) +
          motion *
            (impact *
              (tool === "bridge" ? -0.09 : tool === "prep" ? -0.07 : 0.015) +
              reach * 0.045 +
              throwing.draw * 0.06 -
              throwing.follow * 0.045),
        22,
        dt,
      );
      wrist.current.position.z = T.MathUtils.damp(
        wrist.current.position.z,
        motion *
          (throwing.draw * 0.21 -
            throwing.follow * 0.31 -
            reach * 0.08 -
            harvest.reach * 0.16),
        18,
        dt,
      );
      wrist.current.position.x = T.MathUtils.damp(
        wrist.current.position.x,
        motion * (-harvest.reach * 0.12 - throwing.follow * 0.1),
        18,
        dt,
      );
    }
    if (support.current) {
      support.current.visible = (!!held && !tool) || flying || wave > 0.01;
      support.current.position.x = T.MathUtils.damp(
        support.current.position.x,
        wave > 0.01
          ? -0.58
          : flying
            ? -0.105 * Math.cos(wheel.current?.rotation.z || 0) + 0.025
            : held === "pumpkin"
              ? -0.25
              : -0.43,
        12,
        dt,
      );
      support.current.position.y = T.MathUtils.damp(
        support.current.position.y,
        wave > 0.01
          ? 0.52 * wave
          : flying
            ? 0.265 - 0.105 * Math.sin(wheel.current?.rotation.z || 0)
            : -0.08 + throwing.draw * 0.09 - throwing.follow * 0.05,
        12,
        dt,
      );
      support.current.position.z = T.MathUtils.damp(
        support.current.position.z,
        0.045 + throwing.draw * 0.16 - throwing.follow * 0.2,
        16,
        dt,
      );
      support.current.rotation.x =
        (wave > 0.01 ? -0.4 : reach * -0.2 - throwing.follow * 0.4) * motion;
      support.current.rotation.z =
        wave > 0.01 ? Math.sin(age * 20) * 0.16 * motion : -0.2;
    }
    // Sleeves stay connected below the camera while wrists and tools articulate.
    // Rotating an entire short forearm at the wrist makes it visibly float.
    for (const [mesh, hand, left] of [
      [sleeveRight.current, wrist.current, false],
      [sleeveLeft.current, support.current, true],
    ] as const) {
      if (!mesh || !hand) continue;
      mesh.visible = hand.visible;
      armVectors.from.set(left ? -0.63 : 0.14, -0.56, 0.9);
      hand.updateMatrix();
      armVectors.to
        .set(left ? -0.035 : 0.035, -0.09, 0.06)
        .applyMatrix4(hand.matrix);
      mesh.position
        .copy(armVectors.from)
        .add(armVectors.to)
        .multiplyScalar(0.5);
      armVectors.direction.copy(armVectors.to).sub(armVectors.from);
      const length = armVectors.direction.length();
      mesh.quaternion.setFromUnitVectors(
        armVectors.up,
        armVectors.direction.normalize(),
      );
      mesh.scale.set(1, length / 1.15, 1);
    }
    if (flying && wheel.current) {
      const steering =
        (input.keys.has("KeyD") || input.keys.has("ArrowRight") ? 1 : 0) -
        (input.keys.has("KeyA") || input.keys.has("ArrowLeft") ? 1 : 0) +
        input.touch.x;
      reelTurn.current = T.MathUtils.damp(
        reelTurn.current,
        steering * 3.8,
        9,
        dt,
      );
      wheel.current.rotation.z += reelTurn.current * dt;
      const positions = line.geometry.attributes.position;
      positions.setXYZ(
        1,
        -0.05 + Math.sin(clock.elapsedTime * 2) * 0.02 * motion,
        0.46,
        -0.6,
      );
      positions.needsUpdate = true;
    }
  });
  return (
    <group name="tactile-hands">
      {[sleeveRight, sleeveLeft].map((ref, i) => (
        <mesh key={i} ref={ref} visible={i === 0}>
          <capsuleGeometry args={[0.075, 1, 6, 16]} />
          <meshStandardMaterial
            color={role ? "#568c89" : "#c08a43"}
            roughness={0.94}
          />
        </mesh>
      ))}
      <group ref={wrist}>
        <Hand role={role} opening={() => open.current} />
        <group ref={hammer} visible={false} name="held-hammer">
          <Assembly pieces={hammerWood} />
          <Assembly pieces={hammerMetal} metal />
        </group>
        <group ref={knife} visible={false} name="held-knife">
          <Assembly pieces={knifeHandle} />
          <Assembly pieces={knifeMetal} metal />
        </group>
        <group ref={spoon} visible={false} name="held-spoon">
          <Assembly pieces={spoonPieces} />
        </group>
        <group ref={reel} visible={false} name="held-kite-reel">
          <Assembly pieces={reelGrip} />
          <group ref={wheel} position={[0, 0.205, 0]}>
            <Assembly pieces={reelSpool} />
          </group>
          <primitive object={line} />
        </group>
        <group ref={normal}>
          <group ref={object}>
            {s.hands[role] ? (
              <Lantern
                position={[0, -0.46, -0.055]}
                scale={0.57}
                color={palette[s.hands[role]!.color]}
                shape={s.hands[role]!.shape}
              />
            ) : held ? (
              <group position={[-0.09, -0.12, -0.09]} rotation={[0, 0.2, 0.08]}>
                <Produce kind={held} scale={held === "wood" ? 0.48 : 0.52} />
              </group>
            ) : (
              <Lantern position={[0, -0.29, -0.025]} scale={0.34} />
            )}
          </group>
        </group>
      </group>
      <group
        ref={support}
        position={[-0.43, -0.08, 0.045]}
        rotation={[0.1, 0.25, -0.2]}
        visible={false}
      >
        <Hand role={role} left opening={() => supportOpen.current} />
      </group>
    </group>
  );
}
type Flight = {
  id: string;
  kind: string;
  x: number;
  z: number;
  role: Role;
  at: number;
};
const propById = new Map(props.map((p) => [p.id, p]));
/** Authoritative collection changes trigger a short visual handoff; reloads do not replay it. */
export function HarvestEffects({ s }: { s: State }) {
  const previous = useRef({
    collected: s.collected,
    bag0: s.bags[0].length,
    bag1: s.bags[1].length,
    phase: s.phase,
  });
  const [flights, setFlights] = useState<Flight[]>([]);
  const groups = useRef(new Map<string, T.Group>()),
    particles = useRef<T.InstancedMesh>(null);
  const temp = useMemo(
    () => ({
      object: new T.Object3D(),
      start: new T.Vector3(),
      end: new T.Vector3(),
      control: new T.Vector3(),
      p: new T.Vector3(),
      offset: new T.Vector3(),
    }),
    [],
  );
  useEffect(() => {
    const old = previous.current;
    previous.current = {
      collected: s.collected,
      bag0: s.bags[0].length,
      bag1: s.bags[1].length,
      phase: s.phase,
    };
    if (old.phase !== s.phase) {
      setFlights([]);
      return;
    }
    const delta = s.collected.filter((id) => !old.collected.includes(id));
    if (!delta.length || delta.length > 6) return;
    const available = [
      s.bags[0].length - old.bag0,
      s.bags[1].length - old.bag1,
    ];
    const added: Flight[] = [];
    for (const id of delta) {
      const prop = propById.get(id);
      if (!prop) continue;
      const candidates = ([0, 1] as Role[]).filter((r) => available[r] > 0);
      if (!candidates.length) continue;
      candidates.sort((a, b) => {
        const pa = a === net.snapshot.role ? net.local : net.poses[a],
          pb = b === net.snapshot.role ? net.local : net.poses[b];
        return (
          (pa ? Math.hypot(pa.x - prop.x, pa.z - prop.z) : 100) -
          (pb ? Math.hypot(pb.x - prop.x, pb.z - prop.z) : 100)
        );
      });
      const owner = candidates[0];
      available[owner]--;
      added.push({
        id,
        kind: prop.kind,
        x: prop.x,
        z: prop.z,
        role: owner,
        at: performance.now(),
      });
    }
    if (added.length)
      setFlights((list) =>
        [...list.filter((f) => performance.now() - f.at < 750), ...added].slice(
          -6,
        ),
      );
  }, [s.collected, s.phase, s.bags]);
  useEffect(() => {
    if (!flights.length) return;
    const timer = window.setTimeout(() => setFlights([]), 850);
    return () => clearTimeout(timer);
  }, [flights]);
  useFrame(() => {
    if (!particles.current) return;
    const now = performance.now();
    let n = 0;
    for (const f of flights) {
      const t = Math.min(1, Math.max(0, (now - f.at) / 650)),
        ease = t * t * (3 - 2 * t),
        pose =
          f.role === net.snapshot.role ? net.local : net.motion.sample(now);
      temp.start.set(f.x, 0.35, f.z);
      temp.end.set(pose?.x ?? f.x, (pose?.y ?? 0) + 1.15, pose?.z ?? f.z);
      temp.control.copy(temp.start).lerp(temp.end, 0.5);
      temp.control.y += 1.1;
      temp.p
        .copy(temp.start)
        .multiplyScalar((1 - ease) ** 2)
        .addScaledVector(temp.control, 2 * (1 - ease) * ease)
        .addScaledVector(temp.end, ease * ease);
      const group = groups.current.get(f.id);
      if (group) {
        group.visible = t < 1;
        group.position.copy(temp.p);
        group.rotation.set(t * 0.4, t * 2, t * 0.2);
        group.scale.setScalar(0.85 * (1 - 0.65 * t));
      }
      for (let j = 0; j < 12; j++) {
        const a = j * 2.399 + t * 2,
          r = Math.sin(t * Math.PI) * (0.1 + rand(j + f.x) * 0.3);
        temp.object.position
          .copy(temp.p)
          .add(
            temp.offset.set(Math.cos(a) * r, Math.sin(j) * r, Math.sin(a) * r),
          );
        temp.object.scale.setScalar(t < 1 ? 0.018 * (1 - t) : 0);
        temp.object.rotation.set(t * 4, j, t);
        temp.object.updateMatrix();
        particles.current.setMatrixAt(n++, temp.object.matrix);
      }
    }
    particles.current.count = n;
    particles.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group name="harvest-handoff">
      {flights.map((f) => (
        <group
          key={f.id}
          ref={(el) => {
            if (el) groups.current.set(f.id, el);
            else groups.current.delete(f.id);
          }}
        >
          <Produce kind={f.kind} />
        </group>
      ))}
      <instancedMesh
        ref={particles}
        args={[undefined, undefined, 72]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#f4d38c" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
