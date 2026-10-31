import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Lantern, Produce } from "./Models";
import { input } from "./controls";
import { net } from "./network";
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
          ? new T.SphereGeometry(1, 12, 8)
          : part.kind === "rod"
            ? new T.CylinderGeometry(0.92, 1, 1, 12)
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
function Hand({ role, left = false }: { role: Role; left?: boolean }) {
  const pieces = useMemo<Piece[]>(() => {
    const skin = role ? "#ce9672" : "#b37c59",
      cloth = role ? "#568c89" : "#c08a43",
      cuff = role ? "#bd7753" : "#405e51";
    const all: Piece[] = [
      {
        kind: "round",
        p: [0.026, -0.036, 0.025],
        s: [0.076, 0.074, 0.047],
        color: skin,
      },
      {
        kind: "round",
        p: [0.055, -0.155, 0.16],
        s: [0.075, 0.09, 0.22],
        color: cloth,
        r: [-0.4, 0, -0.1],
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
    for (let i = 0; i < 4; i++) {
      all.push(
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
    return all;
  }, [role]);
  return (
    <group scale={[left ? -1 : 1, 1, 1]}>
      <Assembly pieces={pieces} />
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
/** Camera-local rig. The parent owns walking sway and camera position. */
export function HeldObjectRig({ s, role }: { s: State; role: Role }) {
  const wrist = useRef<T.Group>(null),
    support = useRef<T.Group>(null),
    normal = useRef<T.Group>(null),
    hammer = useRef<T.Group>(null),
    knife = useRef<T.Group>(null),
    spoon = useRef<T.Group>(null);
  const lastTool = useRef({ kind: "", until: 0 });
  const held = s.bags[role]?.[0] || (s.phase === 5 ? "pumpkin" : "");
  useFrame(({ clock }, delta) => {
    const now = performance.now(),
      dt = Math.min(0.05, delta),
      challenge = s.challenge;
    if (challenge?.role === role)
      lastTool.current = { kind: challenge.kind, until: now + 900 };
    const tool = now < lastTool.current.until ? lastTool.current.kind : "";
    if (hammer.current) hammer.current.visible = tool === "bridge";
    if (knife.current) knife.current.visible = tool === "prep";
    if (spoon.current) spoon.current.visible = tool === "cook";
    if (normal.current) normal.current.visible = !tool;
    const age = (Date.now() + net.clockOffset - net.gestureAt) / 1000;
    const strike =
      net.gesture === "hit" && age >= 0 && age < 0.6
        ? Math.sin((age / 0.6) * Math.PI)
        : 0;
    const reach =
      ["collect", "ingredient", "craft", "place", "serve", "moth"].includes(
        net.gesture,
      ) &&
      age >= 0 &&
      age < 0.7
        ? Math.sin((age / 0.7) * Math.PI)
        : 0;
    const charge = input.holding
      ? Math.min(1, (now - input.holding) / 1300)
      : 0;
    if (wrist.current) {
      wrist.current.rotation.x = T.MathUtils.damp(
        wrist.current.rotation.x,
        tool === "bridge"
          ? -0.32 + strike * 1.18
          : tool === "prep"
            ? -0.18 + strike * 0.65
            : tool === "cook"
              ? 0.16 + Math.sin(clock.elapsedTime * 3) * 0.045 + strike * 0.15
              : reach * -0.2 + charge * 0.38,
        16,
        dt,
      );
      wrist.current.rotation.z = T.MathUtils.damp(
        wrist.current.rotation.z,
        tool === "cook"
          ? Math.sin(clock.elapsedTime * 3) * 0.055
          : tool === "prep"
            ? -0.27
            : 0,
        12,
        dt,
      );
      wrist.current.position.y = T.MathUtils.damp(
        wrist.current.position.y,
        (!tool ? (s.hands[role] ? 0.34 : held ? 0.11 : 0.22) : 0) +
          strike *
            (tool === "bridge" ? -0.09 : tool === "prep" ? -0.06 : 0.015) +
          reach * 0.045,
        18,
        dt,
      );
      wrist.current.position.z = T.MathUtils.damp(
        wrist.current.position.z,
        charge * 0.15 - reach * 0.08,
        12,
        dt,
      );
    }
    if (support.current) {
      support.current.visible = !!held && !tool;
      support.current.position.x = T.MathUtils.damp(
        support.current.position.x,
        held === "pumpkin" ? -0.25 : -0.43,
        10,
        dt,
      );
      support.current.rotation.x = reach * -0.2;
    }
  });
  return (
    <group name="tactile-hands">
      <group ref={wrist}>
        <Hand role={role} />
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
        <group ref={normal}>
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
      <group
        ref={support}
        position={[-0.43, -0.08, 0.045]}
        rotation={[0.1, 0.25, -0.2]}
        visible={false}
      >
        <Hand role={role} left />
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
            new T.Vector3(Math.cos(a) * r, Math.sin(j) * r, Math.sin(a) * r),
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
