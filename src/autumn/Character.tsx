import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Lantern, Produce } from "./Models";
import { net } from "./network";
import type { Pose, Role } from "./content";

type Part = {
  shape?: "box" | "sphere" | "capsule" | "cylinder" | "torus";
  p: number[];
  s: number[];
  c: string;
  r?: number[];
};
const skin = ["#b37c59", "#ce9672"];
const coat = ["#c08a43", "#568c89"];
const scarf = ["#405e51", "#bd7753"];
const lanternColors = [
  "#ffbd68",
  "#9ce0cc",
  "#e9a7c8",
  "#a9b9ed",
  "#e6d58f",
  "#e89b78",
];
let weave: T.CanvasTexture | undefined;
function fabric() {
  if (weave) return weave;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#ede8de";
  c.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4)
    for (let x = 0; x < 128; x += 4) {
      c.fillStyle = (x + y) % 8 ? "#c8c2b5" : "#fcf7ec";
      c.fillRect(x, y, 2, 3);
      c.fillStyle = "#a89d8840";
      c.fillRect(x + 2, y + 1, 1, 2);
    }
  weave = new T.CanvasTexture(canvas);
  weave.wrapS = weave.wrapT = T.RepeatWrapping;
  weave.repeat.set(3, 3);
  weave.colorSpace = T.SRGBColorSpace;
  weave.anisotropy = 4;
  return weave;
}
/** Rigid details share a single draw call, including every seam, buckle and button. */
function Detail({
  parts,
  textile = false,
  metal = false,
}: {
  parts: Part[];
  textile?: boolean;
  metal?: boolean;
}) {
  const geo = useMemo(() => {
    const matrix = new T.Matrix4(),
      q = new T.Quaternion(),
      p = new T.Vector3(),
      s = new T.Vector3(),
      color = new T.Color();
    const list = parts.map((part) => {
      let g: T.BufferGeometry;
      switch (part.shape) {
        case "sphere":
          g = new T.SphereGeometry(1, 16, 12);
          break;
        case "capsule":
          g = new T.CapsuleGeometry(0.5, 1, 6, 12);
          break;
        case "cylinder":
          g = new T.CylinderGeometry(0.85, 1, 1, 16);
          break;
        case "torus":
          g = new T.TorusGeometry(1, 0.13, 6, 20);
          break;
        default:
          g = new T.BoxGeometry(1, 1, 1);
      }
      p.fromArray(part.p);
      s.fromArray(part.s);
      q.setFromEuler(
        new T.Euler(...((part.r || [0, 0, 0]) as [number, number, number])),
      );
      matrix.compose(p, q, s);
      g.applyMatrix4(matrix);
      const colors = new Float32Array(g.attributes.position.count * 3);
      color.set(part.c);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }
      g.setAttribute("color", new T.BufferAttribute(colors, 3));
      return g;
    });
    const result = mergeGeometries(list)!;
    list.forEach((g) => g.dispose());
    return result;
  }, [parts]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        map={textile ? fabric() : null}
        roughness={metal ? 0.38 : textile ? 0.94 : 0.68}
        metalness={metal ? 0.5 : 0}
      />
    </mesh>
  );
}
function initialsTexture(role: Role) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.fillStyle = "#dac5a0";
  x.beginPath();
  x.roundRect(8, 8, 112, 112, 16);
  x.fill();
  x.strokeStyle = "#7d6d50";
  x.setLineDash([4, 4]);
  x.lineWidth = 3;
  x.strokeRect(15, 15, 98, 98);
  x.fillStyle = "#405447";
  x.font = "bold 66px Georgia";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(role ? "M" : "H", 64, 69);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
export type CharacterProps = {
  role: Role;
  pose: () => Pose | undefined;
  held?: string;
  lantern?: { color: number; shape: number } | null;
};
/** Facing local +Z. Parent owns world translation and heading, this rig owns animation. */
export function Character({ role, pose, held = "", lantern }: CharacterProps) {
  const root = useRef<T.Group>(null),
    torso = useRef<T.Group>(null),
    head = useRef<T.Group>(null),
    eyes = useRef<T.Group>(null),
    tail = useRef<T.Group>(null);
  const carryRef = useRef<T.Group>(null);
  const thighs = useRef<(T.Group | null)[]>([]),
    knees = useRef<(T.Group | null)[]>([]),
    arms = useRef<(T.Group | null)[]>([]),
    elbows = useRef<(T.Group | null)[]>([]);
  const last = useRef<{ x: number; y: number; z: number; yaw: number } | null>(
    null,
  );
  const gait = useRef(0),
    speed = useRef(0),
    bounce = useRef(0),
    previousVY = useRef(0),
    action = useRef(0),
    turn = useRef(0);
  const embroidery = useMemo(() => initialsTexture(role), [role]);
  useEffect(() => () => embroidery.dispose(), [embroidery]);
  const parts = useMemo(() => {
    const jacket: Part[] = [
      {
        shape: "capsule",
        p: [0, 1.035, 0],
        s: [0.51, 0.295, 0.39],
        c: coat[role],
      },
      {
        shape: "cylinder",
        p: [0, 0.77, 0],
        s: [0.29, 0.25, 0.235],
        c: coat[role],
      },
      { p: [0, 1.05, 0.205], s: [0.028, 0.54, 0.025], c: "#715c40" },
      {
        p: [-0.11, 1.27, 0.185],
        s: [0.15, 0.16, 0.035],
        c: coat[role],
        r: [-0.1, 0, -0.28],
      },
      {
        p: [0.11, 1.27, 0.185],
        s: [0.15, 0.16, 0.035],
        c: coat[role],
        r: [-0.1, 0, 0.28],
      },
      { p: [0, 0.72, 0], s: [0.46, 0.035, 0.41], c: "#705239" },
    ];
    for (const side of [-1, 1]) {
      jacket.push({
        p: [side * 0.17, 0.92, 0.2],
        s: [0.13, 0.16, 0.035],
        c: role ? "#487b78" : "#aa7639",
      });
      for (let i = 0; i < 6; i++)
        jacket.push({
          p: [side * 0.17 - 0.055 + i * 0.022, 0.99, 0.224],
          s: [0.008, 0.004, 0.003],
          c: "#dfcaa0",
        });
      jacket.push({
        p: [side * 0.19, 1.17, -0.195],
        s: [0.048, 0.45, 0.045],
        c: "#5a4535",
        r: [0, 0, side * 0.1],
      });
    }
    const leather: Part[] = [
      {
        shape: "capsule",
        p: [0, 1.12, -0.255],
        s: [0.35, 0.22, 0.19],
        c: "#79573c",
      },
      { p: [0, 1.31, -0.27], s: [0.36, 0.1, 0.21], c: "#936c46" },
      { p: [0, 1.03, -0.36], s: [0.27, 0.17, 0.05], c: "#956b48" },
      { p: [-0.105, 1.14, -0.37], s: [0.036, 0.32, 0.025], c: "#59402f" },
      { p: [0.105, 1.14, -0.37], s: [0.036, 0.32, 0.025], c: "#59402f" },
      {
        shape: "cylinder",
        p: [0, 1.43, -0.27],
        s: [0.105, 0.47, 0.105],
        c: "#bec0a1",
        r: [0, 0, Math.PI / 2],
      },
      { p: [-0.14, 1.43, -0.27], s: [0.025, 0.19, 0.23], c: "#66503a" },
      { p: [0.14, 1.43, -0.27], s: [0.025, 0.19, 0.23], c: "#66503a" },
    ];
    const metal: Part[] = [];
    for (const y of [0.83, 1.01, 1.2])
      metal.push({
        shape: "sphere",
        p: [0, y, 0.233],
        s: [0.018, 0.018, 0.009],
        c: "#deb876",
      });
    for (const x of [-0.105, 0.105])
      metal.push({
        p: [x, 1.18, -0.392],
        s: [0.052, 0.042, 0.012],
        c: "#d3ad69",
      });
    metal.push({ p: [0, 0.72, 0.22], s: [0.075, 0.055, 0.018], c: "#d3ad69" });
    const face: Part[] = [
      {
        shape: "sphere",
        p: [0, 0, 0],
        s: [0.211, 0.247, 0.204],
        c: skin[role],
      },
      {
        shape: "sphere",
        p: [0, -0.035, 0.204],
        s: [0.036, 0.048, 0.043],
        c: skin[role],
      },
      {
        shape: "sphere",
        p: [0, -0.119, 0.183],
        s: [0.05, 0.008, 0.015],
        c: "#87513e",
      },
      ...[-1, 1].map((side) => ({
        shape: "sphere" as const,
        p: [side * 0.207, -0.01, -0.005],
        s: [0.041, 0.063, 0.038],
        c: skin[role],
      })),
    ];
    const hair: Part[] = [
      {
        shape: "sphere",
        p: [0, 0.14, -0.025],
        s: [0.217, 0.14, 0.201],
        c: "#332823",
      },
      ...[-1, 1].map((side) => ({
        shape: "sphere" as const,
        p: [side * 0.183, 0.06, -0.056],
        s: [0.045, role ? 0.18 : 0.11, 0.14],
        c: "#332823",
      })),
    ];
    if (role)
      hair.push({
        shape: "sphere",
        p: [0, -0.015, -0.13],
        s: [0.2, 0.22, 0.105],
        c: "#332823",
      });
    for (let i = 0; i < 7; i++)
      hair.push({
        shape: "sphere",
        p: [-0.15 + i * 0.047, 0.16 + Math.sin(i) * 0.018, 0.1],
        s: [0.06, 0.055, 0.088],
        c: i % 2 ? "#342923" : "#423128",
        r: [0, 0, 0.3],
      });
    const eyeDetails: Part[] = [];
    for (const side of [-1, 1]) {
      eyeDetails.push(
        {
          shape: "sphere",
          p: [side * 0.076, 0.025, 0.183],
          s: [0.037, 0.02, 0.023],
          c: "#f4ead9",
        },
        {
          shape: "sphere",
          p: [side * 0.076, 0.025, 0.204],
          s: [0.017, 0.017, 0.009],
          c: "#372d24",
        },
        {
          shape: "sphere",
          p: [side * 0.07, 0.031, 0.213],
          s: [0.005, 0.005, 0.003],
          c: "#fff6db",
        },
      );
      hair.push({
        p: [side * 0.079, 0.072, 0.188],
        s: [0.074, 0.013, 0.012],
        c: "#3d2b25",
        r: [0, 0, side * 0.06],
      });
    }
    return { jacket, leather, metal, face, hair, eyeDetails };
  }, [role]);
  const limbParts = useMemo(() => {
    const upperLeg: Part[] = [
      {
        shape: "capsule",
        p: [0, -0.13, 0],
        s: [0.175, 0.14, 0.18],
        c: "#374346",
      },
    ];
    const lowerLeg: Part[] = [
      { shape: "sphere", p: [0, 0, 0], s: [0.084, 0.082, 0.086], c: "#374346" },
      {
        shape: "capsule",
        p: [0, -0.125, 0],
        s: [0.145, 0.13, 0.16],
        c: "#3b4749",
      },
      { p: [0, -0.214, 0], s: [0.157, 0.045, 0.17], c: "#58615b" },
    ];
    const boot: Part[] = [
      {
        shape: "capsule",
        p: [0, -0.3, 0.046],
        s: [0.18, 0.075, 0.29],
        c: "#634630",
      },
      { p: [0, -0.363, 0.042], s: [0.19, 0.033, 0.285], c: "#2b2e2a" },
      { p: [0, -0.285, 0.13], s: [0.12, 0.055, 0.08], c: "#76543a" },
    ];
    for (let i = 0; i < 3; i++)
      boot.push({
        p: [0, -0.22 - i * 0.024, 0.14],
        s: [0.095, 0.008, 0.008],
        c: "#c4ae7e",
      });
    const upperArm: Part[] = [
      {
        shape: "capsule",
        p: [0, -0.125, 0],
        s: [0.18, 0.145, 0.19],
        c: coat[role],
      },
    ];
    const lowerArm: Part[] = [
      {
        shape: "sphere",
        p: [0, 0, 0],
        s: [0.083, 0.085, 0.087],
        c: coat[role],
      },
      {
        shape: "capsule",
        p: [0, -0.112, 0],
        s: [0.155, 0.13, 0.16],
        c: coat[role],
      },
      {
        shape: "cylinder",
        p: [0, -0.223, 0],
        s: [0.084, 0.055, 0.084],
        c: scarf[role],
      },
    ];
    const hand: Part[] = [
      {
        shape: "sphere",
        p: [0, -0.287, 0],
        s: [0.071, 0.073, 0.045],
        c: skin[role],
      },
      {
        shape: "capsule",
        p: [-0.058, -0.285, 0.025],
        s: [0.032, 0.027, 0.035],
        c: skin[role],
        r: [0, 0, -0.3],
      },
    ];
    for (let i = 0; i < 4; i++)
      hand.push({
        shape: "capsule",
        p: [-0.046 + i * 0.03, -0.337, 0.007],
        s: [0.022, 0.026, 0.029],
        c: skin[role],
      });
    return { upperLeg, lowerLeg, boot, upperArm, lowerArm, hand };
  }, [role]);
  const neck = useMemo<Part[]>(
    () => [
      {
        shape: "cylinder",
        p: [0, 1.405, 0],
        s: [0.084, 0.13, 0.08],
        c: skin[role],
      },
      {
        shape: "torus",
        p: [0, 1.36, 0],
        s: [0.224, 0.185, 0.26],
        r: [Math.PI / 2, 0, 0],
        c: scarf[role],
      },
      {
        shape: "torus",
        p: [0, 1.325, 0],
        s: [0.23, 0.19, 0.2],
        r: [Math.PI / 2, 0, 0],
        c: scarf[role],
      },
    ],
    [role],
  );
  const scarfParts = useMemo<Part[]>(
    () => [
      { p: [0, -0.17, 0], s: [0.115, 0.34, 0.032], c: scarf[role] },
      ...Array.from({ length: 6 }, (_, i) => ({
        p: [-0.045 + i * 0.018, -0.36, 0],
        s: [0.011, 0.065, 0.018],
        c: scarf[role],
      })),
    ],
    [role],
  );
  useFrame(({ clock }, delta) => {
    const p = pose();
    if (!p) return;
    const dt = Math.min(0.05, delta),
      time = clock.elapsedTime,
      old = last.current;
    let actual = 0,
      vy = 0;
    if (old) {
      const distance = Math.hypot(p.x - old.x, p.z - old.z);
      actual = distance < 1 ? distance / Math.max(0.001, delta) : 0;
      vy = (p.y - old.y) / Math.max(0.001, delta);
      turn.current = T.MathUtils.damp(
        turn.current,
        Math.atan2(Math.sin(p.yaw - old.yaw), Math.cos(p.yaw - old.yaw)) /
          Math.max(0.001, delta),
        8,
        dt,
      );
    }
    last.current = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    speed.current = T.MathUtils.damp(
      speed.current,
      Math.min(7, actual),
      10,
      dt,
    );
    const walk = Math.min(1, speed.current / 3.6),
      run = Math.max(0, (speed.current - 4.4) / 2.4);
    gait.current += speed.current * dt * 2.6;
    const stride = Math.sin(gait.current),
      air = p.scene !== "river" && (p.y > 0.46 || Math.abs(vy) > 1.3);
    if (previousVY.current < -1 && vy > -0.2)
      bounce.current = Math.min(0.075, -previousVY.current * 0.012);
    previousVY.current = vy;
    bounce.current = T.MathUtils.damp(bounce.current, 0, 9, dt);
    const age = (Date.now() + net.clockOffset - (p.gestureAt || 0)) / 1000;
    const working = !!p.gesture && age >= 0 && age < 0.85;
    action.current = T.MathUtils.damp(
      action.current,
      working ? Math.sin((age / 0.85) * Math.PI) : 0,
      20,
      dt,
    );
    const act = action.current,
      throwing = p.gesture === "throw",
      hitting = p.gesture === "hit";
    if (root.current) {
      root.current.position.y =
        Math.abs(stride) * 0.025 * walk - bounce.current;
      root.current.rotation.z = T.MathUtils.damp(
        root.current.rotation.z,
        -stride * 0.018 * walk - turn.current * 0.008,
        9,
        dt,
      );
    }
    if (torso.current) {
      torso.current.rotation.x = T.MathUtils.damp(
        torso.current.rotation.x,
        run * 0.09 +
          (hitting ? 0.14 * act : 0) +
          (p.gesture === "collect" ? 0.13 * act : 0),
        9,
        dt,
      );
      torso.current.scale.y = 1 + Math.sin(time * 1.8) * 0.003;
    }
    if (head.current) {
      head.current.rotation.x = T.MathUtils.damp(
        head.current.rotation.x,
        -p.pitch * 0.65 - (air ? 0.08 : 0),
        12,
        dt,
      );
      head.current.rotation.y = T.MathUtils.damp(
        head.current.rotation.y,
        Math.max(-0.3, Math.min(0.3, turn.current * 0.04)),
        8,
        dt,
      );
    }
    if (eyes.current) {
      const blink = (time + role * 1.7) % 4.7;
      eyes.current.scale.y =
        blink < 0.13 ? Math.max(0.05, Math.abs(blink - 0.065) / 0.065) : 1;
    }
    if (tail.current) {
      tail.current.rotation.x =
        0.1 +
        walk * 0.15 +
        Math.sin(time * 3 + gait.current * 0.3) * (0.04 + walk * 0.025);
      tail.current.rotation.z =
        Math.sin(time * 2) * 0.045 - turn.current * 0.015;
    }
    for (let i = 0; i < 2; i++) {
      const phase = gait.current + i * Math.PI,
        step = Math.sin(phase),
        leg = thighs.current[i],
        knee = knees.current[i],
        arm = arms.current[i],
        elbow = elbows.current[i];
      if (leg)
        leg.rotation.x = T.MathUtils.damp(
          leg.rotation.x,
          air ? -0.25 + (i ? -0.2 : 0.2) : step * (0.5 + run * 0.18) * walk,
          15,
          dt,
        );
      if (knee)
        knee.rotation.x = T.MathUtils.damp(
          knee.rotation.x,
          air
            ? 0.52
            : Math.max(0, -Math.cos(phase)) * (0.68 + run * 0.45) * walk,
          15,
          dt,
        );
      if (arm) {
        const carry = i === 1 && (!!held || !!lantern);
        const poseAction =
          i === 1
            ? throwing
              ? -1.9 * act
              : hitting
                ? -1.3 * act
                : -0.72 * act
            : -0.25 * act;
        arm.rotation.x = T.MathUtils.damp(
          arm.rotation.x,
          carry ? -0.32 : air ? -0.28 : step * -0.39 * walk + poseAction,
          14,
          dt,
        );
        arm.rotation.z = (i ? -0.06 : 0.06) + (air ? (i ? -0.16 : 0.16) : 0);
      }
      if (elbow)
        elbow.rotation.x = T.MathUtils.damp(
          elbow.rotation.x,
          (i === 1 && (held || lantern) ? -0.78 : -0.1 - run * 0.5) -
            (i === 1 ? 0.7 * act : 0),
          14,
          dt,
        );
    }
    if (carryRef.current && lantern)
      carryRef.current.rotation.x =
        -(arms.current[1]?.rotation.x || 0) -
        (elbows.current[1]?.rotation.x || 0) -
        (torso.current?.rotation.x || 0);
  });
  return (
    <group ref={root} name={`adventurer-${role ? "mingy" : "harsha"}`}>
      {[-1, 1].map((side, i) => (
        <group
          key={side}
          ref={(el) => {
            thighs.current[i] = el;
          }}
          position={[side * 0.122, 0.685, 0]}
        >
          <Detail parts={limbParts.upperLeg} textile />
          <group
            ref={(el) => {
              knees.current[i] = el;
            }}
            position={[0, -0.3, 0]}
          >
            <Detail parts={limbParts.lowerLeg} textile />
            <Detail parts={limbParts.boot} />
          </group>
        </group>
      ))}
      <group ref={torso}>
        <Detail parts={parts.jacket} textile />
        <Detail parts={parts.leather} />
        <Detail parts={parts.metal} metal />
        <Detail parts={neck} textile />
        <mesh position={[-0.135, 1.17, 0.224]}>
          <planeGeometry args={[0.073, 0.073]} />
          <meshStandardMaterial map={embroidery} roughness={0.95} />
        </mesh>
        <group ref={tail} position={[0.145, 1.34, 0.218]}>
          <Detail parts={scarfParts} textile />
        </group>
        <group ref={head} position={[0, 1.615, 0]}>
          <Detail parts={parts.face} />
          <Detail parts={parts.hair} />
          <group ref={eyes}>
            <Detail parts={parts.eyeDetails} />
          </group>
        </group>
        {[-1, 1].map((side, i) => (
          <group
            key={side}
            ref={(el) => {
              arms.current[i] = el;
            }}
            position={[side * 0.305, 1.275, 0]}
          >
            <Detail parts={limbParts.upperArm} textile />
            <group
              ref={(el) => {
                elbows.current[i] = el;
              }}
              position={[0, -0.265, 0]}
            >
              <Detail parts={limbParts.lowerArm} textile />
              <Detail parts={limbParts.hand} />
              {i === 1 && (
                <group
                  ref={carryRef}
                  position={[0, -0.33, 0.075]}
                  rotation={[0.25, 0, 0]}
                >
                  {lantern ? (
                    <Lantern
                      position={[0, -0.44, 0]}
                      scale={0.55}
                      color={lanternColors[lantern.color]}
                      shape={lantern.shape}
                    />
                  ) : held ? (
                    <Produce
                      kind={held}
                      scale={0.5}
                      position={[0, -0.05, 0.08]}
                    />
                  ) : null}
                </group>
              )}
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
