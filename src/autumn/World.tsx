import {
  Suspense,
  memo,
  lazy,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Stars, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as T from "three";
import { HeldObjectRig, HarvestEffects } from "./ActionDetails";
import { Character } from "./Character";
import { WorldDetails, ReflectiveWater, BuiltBridge } from "./WorldDetails";
import { Landscape } from "./Landscape";
import { RealSky } from "./RealSky";
import { LocalLightingProvider, LocalLightSource } from "./LocalLighting";
import { EnvironmentResponse } from "./EnvironmentResponse";
import { WoodlandAudio } from "./WoodlandAudio";
import { ScenicBackdrop } from "./ScenicBackdrop";
import { RiverTerrain } from "./RiverTerrain";
import { ForestFloor } from "./ForestFloor";
import { Wildlife } from "./Wildlife";
import { RenderBudget } from "./RenderBudget";
import { StaticGeometry } from "./StaticGeometry";
import { expeditionTargets } from "./expeditionPlay";
import {
  hollowSpawn,
  hollowObstacles,
  expeditionBounds,
} from "./expeditionContent";
import { net } from "./network";
import { media } from "./media";
import { input, trackpadLook } from "./controls";
import { sound } from "./sound";
import {
  colors,
  names,
  props,
  stations,
  towers,
  lanternStands,
  moths,
  tables,
  rand,
  spawn,
  riverStops,
  riverBends,
  obstacles,
  fairTarget,
  throwPath,
  windAt,
  riverLength,
} from "./content";
import type { State } from "../../server/autumn/rules";
import type { Role } from "./content";
import {
  Box,
  Cottage,
  Forest,
  Lantern,
  Orb,
  Pole,
  Produce,
  Sign,
  mat,
  lanternBodyGeometry,
  lanternFrameGeometry,
  lanternFrameMaterial,
  paperMap,
  finishLanternPaper,
} from "./Models";
const ExpeditionWorld = lazy(() => import("./ExpeditionWorld"));
export type Target = {
  id: string;
  label: string;
  kind: string;
  x: number;
  z: number;
  role?: Role;
  action?: string;
};
export const lanternColors = [
  "#ffbd68",
  "#9ce0cc",
  "#e9a7c8",
  "#a9b9ed",
  "#e6d58f",
  "#e89b78",
];
export function targetsFor(s: State, role: Role): Target[] {
  if (s.phase === 9) return expeditionTargets(s.expedition, role);
  const out: Target[] = [];
  for (const [id, v] of Object.entries(stations))
    if (v.phase === s.phase)
      out.push({
        ...v,
        id,
        kind: id.startsWith("pitch-") ? "throw" : "station",
      });
  if (s.phase === 1 || s.phase === 2)
    for (const p of props)
      if (p.phase === s.phase && !s.collected.includes(p.id))
        out.push({
          ...p,
          label: p.kind === "wood" ? "Gather timber" : `Harvest ${p.kind}`,
          kind: "collect",
        });
  if (s.phase === 4)
    out.push({
      ...tables[s.order],
      label: s.dish?.cooked ? "Serve this table" : "Your next table",
      kind: "table",
    });
  if (s.phase === 6)
    for (const [i, t] of towers.entries())
      if (!s.towers.includes(i)) {
        out.push({
          id: `tower-${i}`,
          x: t.x + 3,
          z: t.z,
          label: "Fly the kite",
          kind: "kite",
          role: (i % 2) as Role,
        });
        out.push({
          id: `ground-${i}`,
          x: t.x - 3,
          z: t.z,
          label: "Hold this ground switch",
          kind: "ground",
          role: (1 - (i % 2)) as Role,
        });
      }
  if (s.phase === 7)
    for (const l of lanternStands)
      if (!s.lanterns[l.id])
        out.push({ ...l, label: "Place your lantern", kind: "lantern" });
  if (s.phase > 0)
    for (const m of moths)
      if (!s.moths.includes(m.id))
        out.push({ ...m, label: "Keep a little light", kind: "moth" });
  return out;
}
function Village({ s }: { s: State }) {
  const wheel = useRef<T.Group>(null);
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.x += dt * 0.18;
  });
  return (
    <>
      <group position={[0, 0, 49]} rotation={[0, Math.PI, 0]}>
        <Cottage scale={1.6} color="#d1b994" />
        <Sign text="BRAMBLEWICK" p={[0, 3.8, 4.05]} width={4.3} />
        <Box p={[0, 0.1, 6.2]} s={[15, 0.2, 5]} color="#8d7456" />
        {[-6, 6].map((x) => (
          <Pole key={x} p={[x, 1.8, 6]} r={0.14} h={3.6} />
        ))}
        <Box p={[0, 3.65, 6]} s={[14, 0.25, 3]} color="#495c52" />
      </group>
      <Cottage position={[-22, 0, 36]} rotation={0.55} color="#c5b69a" />
      <Cottage position={[23, 0, 37]} rotation={-0.65} color="#c8ad83" />
      <Cottage position={[36, 0, 17]} rotation={-1.3} color="#c5bd9e" />
      <Cottage position={[-39, 0, 24]} rotation={1.1} color="#b5b394" />
      <group position={[38, 0, -29]} rotation={[0, -0.55, 0]}>
        <Cottage scale={1.5} color="#ad9b7f" />
        <Sign text="THE OLD MILL" p={[0, 3.6, 3.8]} width={3} />
        <group ref={wheel} position={[-5, 2, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[2, 0.18, 8, 30]} />
            <meshStandardMaterial color="#684b35" />
          </mesh>
          {Array.from({ length: 10 }, (_, i) => (
            <group key={i} rotation={[(i / 10) * Math.PI * 2, 0, 0]}>
              <Box p={[0, 1, 0]} s={[0.3, 2, 0.15]} />
              <Box p={[0, 2, 0]} s={[1.2, 0.25, 0.55]} color="#a47e50" />
            </group>
          ))}
        </group>
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          {Array.from({ length: 7 }, (_, i) => (
            <group key={i} position={[side * 5, 0, 36 - i * 11]}>
              <Pole p={[0, 1.65, 0]} r={0.09} h={3.3} />
              <Pole
                p={[side * -0.35, 3.24, 0]}
                h={0.8}
                r={0.045}
                rotation={[0, 0, Math.PI / 2]}
              />
              <Lantern position={[side * -0.7, 2.3, 0]} scale={0.75} />
            </group>
          ))}
        </group>
      ))}
      {Array.from({ length: 13 }, (_, i) => (
        <group
          key={i}
          position={[-18 + i * 3, 4.5 - Math.sin((i / 12) * Math.PI) * 1.2, 17]}
        >
          <Lantern scale={0.4} color={i % 2 ? "#e8b261" : "#b1d3ba"} />
        </group>
      ))}
      <Box p={[0, 4.5, 17]} s={[38, 0.025, 0.025]} color="#776a4b" />
      <group position={[-24, 0, 5]}>
        <Box p={[0, 0.8, 0]} s={[3.3, 0.23, 2]} color="#9b7347" />
        {[-1.4, 1.4].map((x) => (
          <Box key={x} p={[x, 1.15, 0]} s={[0.15, 0.65, 2]} />
        ))}
        {[-1.2, 1.2].map((x) => (
          <group key={x}>
            {[-0.8, 0.8].map((z) => (
              <mesh
                key={z}
                position={[x, 0.4, z]}
                rotation={[0, Math.PI / 2, 0]}
              >
                <torusGeometry args={[0.38, 0.08, 6, 12]} />
                <meshStandardMaterial color="#4d4236" />
              </mesh>
            ))}
          </group>
        ))}
        <Sign text="THE HARVEST" p={[0, 1.35, 1.05]} width={2.5} />
        {Array.from(
          {
            length: Math.min(
              12,
              Object.values(s.harvest).reduce((a, b) => a + b, 0),
            ),
          },
          (_, i) => (
            <Produce
              key={i}
              kind={["apple", "pumpkin", "mushroom"][i % 3]}
              position={[
                (i % 4) * 0.6 - 0.9,
                0.93,
                Math.floor(i / 4) * 0.5 - 0.55,
              ]}
              scale={0.65}
            />
          ),
        )}
      </group>
      <group position={[26, 0, -22]}>
        <Box p={[0, 1, 0]} s={[4, 0.2, 2]} color="#a87a4e" />
        {[-1.6, 1.6].map((x) => (
          <Box key={x} p={[x, 0.5, 0]} s={[0.2, 1, 1.6]} />
        ))}
        <Sign text="BUILD SOMETHING GOOD" p={[0, 1.5, -0.7]} width={2.8} />
        <Produce kind="wood" position={[-1, 1.1, 0]} />
        <Box p={[0.7, 1.18, 0]} s={[0.6, 0.16, 0.3]} color="#77817e" />
        <Pole
          p={[0.7, 1.2, 0.38]}
          r={0.045}
          h={0.7}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
      <BuiltBridge s={s} />
      {s.phase === 3 && <MooredBoat />}
      <group position={[0, 0, 13]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.3, 1.65, 20]} />
          <meshStandardMaterial color="#7b7565" />
        </mesh>
        <Produce kind="wood" position={[0, 0.12, 0]} />

        <Sparkles
          count={22}
          scale={[1, 3, 1]}
          position={[0, 1.3, 0]}
          size={3}
          speed={0.45}
          color="#ffd57c"
        />
        <pointLight
          position={[0, 1.3, 0]}
          intensity={5}
          distance={13}
          color="#ffad5f"
        />
      </group>
    </>
  );
}
function MooredBoat() {
  const hull = useRef<T.Group>(null);
  useFrame(({ clock }) => {
    if (!hull.current) return;
    hull.current.position.y = Math.sin(clock.elapsedTime * 1.1) * 0.025;
    hull.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.012;
  });
  return (
    <group position={[5.1, 0.05, -75.5]} rotation={[0, Math.PI / 2, 0]}>
      <group ref={hull}>
        <StaticGeometry>
          <Box p={[0, 0.21, 0]} s={[2.4, 0.3, 4.8]} color="#83603f" />
          {[-1, 1].map((side) => (
            <Box
              key={side}
              p={[side * 1.2, 0.51, 0]}
              s={[0.16, 0.7, 4.9]}
              color="#a0754a"
            />
          ))}
          {[-2.3, 2.3].map((z) => (
            <Box
              key={z}
              p={[0, 0.51, z]}
              s={[2.4, 0.7, 0.15]}
              color="#a0754a"
            />
          ))}
          {[-1.3, 1.2].map((z) => (
            <Box
              key={z}
              p={[0, 0.61, z]}
              s={[2.3, 0.1, 0.45]}
              color="#bc9560"
            />
          ))}
          <Pole p={[0, 1.5, -0.4]} r={0.055} h={3} />
          <Lantern position={[0, 1.85, -0.4]} scale={0.65} />
        </StaticGeometry>
      </group>
    </group>
  );
}
function Kitchen({ s }: { s: State }) {
  return (
    <group>
      {(["pantryApple", "pantryMushroom", "pantryPumpkin"] as const).map(
        (id, i) => {
          const p = stations[id];
          return (
            <group key={id} position={[p.x, 0, p.z]}>
              <Box p={[0, 0.65, 0]} s={[2, 0.22, 1.4]} color="#a57e50" />
              <Box p={[0, 0.3, 0]} s={[1.6, 0.6, 1.2]} />
              <Produce
                kind={["apple", "mushroom", "pumpkin"][i]}
                position={[0, 0.8, 0]}
              />
              <Sign
                text={["APPLES", "MUSHROOMS", "PUMPKINS"][i]}
                p={[0, 1.65, 0]}
                width={1.7}
              />
            </group>
          );
        },
      )}
      <group position={[-5, 0, 20]}>
        <Box p={[0, 0.9, 0]} s={[2.8, 0.22, 1.6]} color="#b29469" />
        {[-1.1, 1.1].map((x) => (
          <Box key={x} p={[x, 0.45, 0]} s={[0.18, 0.9, 1.2]} />
        ))}
        <Box p={[0, 1.04, 0]} s={[1.4, 0.08, 0.7]} color="#dfbf83" />
        <Box p={[0.6, 1.12, 0]} s={[0.08, 0.09, 0.7]} color="#a5afa4" />
      </group>
      <group position={[5, 0, 20]}>
        <Box p={[0, 0.6, 0]} s={[2.4, 1.2, 1.7]} color="#566665" />
        <Pole p={[0, 1.3, 0]} r={0.65} h={0.28} color="#b77e4b" />
        <Orb
          p={[0, 1.42, 0]}
          s={[0.55, 0.04, 0.55]}
          color={s.dish?.cooked ? "#deae60" : "#96714b"}
        />
        <Pole p={[0.95, 2, -0.5]} r={0.16} h={3} color="#58635e" />
        {s.dish && (
          <Sparkles
            count={12}
            scale={[0.6, 1.2, 0.6]}
            position={[0, 1.9, 0]}
            size={5}
            speed={0.25}
            color="#f6e7c3"
          />
        )}
      </group>
      <StaticGeometry revision={s.order}>
        {tables.map((p, i) => (
          <group key={p.id} position={[p.x, 0, p.z]}>
            <Pole p={[0, 0.5, 0]} r={0.12} h={1} />
            <Pole p={[0, 1, 0]} r={1.4} h={0.15} color="#c3a576" />
            <Lantern position={[0, 1.1, 0]} scale={0.6} />
            {i < s.order && (
              <Orb
                p={[0.5, 1.12, 0.2]}
                s={[0.35, 0.04, 0.35]}
                color="#e1d4b1"
              />
            )}
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 1.8, 0, 0]}>
                <Box p={[0, 0.45, 0]} s={[0.7, 0.12, 0.7]} />
                <Orb
                  p={[0, 0.95, 0]}
                  s={[0.35, 0.5, 0.3]}
                  color={["#849c8a", "#a17e65", "#8e839b"][i % 3]}
                />
                <Orb p={[0, 1.5, 0]} s={[0.27, 0.27, 0.25]} color="#d2b28b" />
                {[-1, 1].map((e) => (
                  <Orb
                    key={e}
                    p={[e * 0.1, 1.55, 0.23]}
                    s={[0.03, 0.035, 0.02]}
                    color="#293d3d"
                  />
                ))}
                <mesh position={[0, 1.87, 0]}>
                  <coneGeometry args={[0.34, 0.5, 8]} />
                  <meshStandardMaterial color={i % 2 ? "#bd8d4b" : "#6c8d7a"} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </StaticGeometry>
    </group>
  );
}
function Carnival({ s, role }: { s: State; role: Role }) {
  const arc = useRef<T.InstancedMesh>(null),
    shots = useRef<T.Group>(null);
  const fair = s.fair || {
    round: 0,
    throws: [0, 0],
    scores: [0, 0],
    shots: [],
  };
  useFrame(() => {
    const now = Date.now() + net.clockOffset;
    if (arc.current) {
      arc.current.visible = input.holding > 0;
      const held = input.holding ? performance.now() - input.holding : 600,
        o = new T.Object3D();
      for (let i = 0; i < 26; i++) {
        const p = throwPath(net.local, input.yaw, input.pitch, held, i * 0.09);
        o.position.set(p.x, Math.max(0.06, p.y), p.z);
        o.scale.setScalar(p.y < 0 ? 0 : 0.05);
        o.updateMatrix();
        arc.current.setMatrixAt(i, o.matrix);
      }
      arc.current.instanceMatrix.needsUpdate = true;
    }
    if (shots.current)
      shots.current.children.forEach((object, i) => {
        const shot = fair.shots[i];
        if (!shot) return;
        const t = (now - shot.at) / 1000;
        const p = throwPath(shot, shot.yaw, shot.pitch, shot.held, t);
        object.visible = t < 5 && p.y > -0.4;
        object.position.set(p.x, Math.max(0.13, p.y), p.z);
        object.rotation.set(t * 3, t * 2, 0);
      });
  });
  return (
    <>
      {([0, 1] as Role[]).map((r) => {
        const t = fairTarget(fair.round, r),
          p = stations[`pitch-${r}`];
        return (
          <group key={r}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.04, p.z]}>
              <circleGeometry args={[1.8, 40]} />
              <meshStandardMaterial color={colors[r]} roughness={1} />
            </mesh>
            <group position={[t.x, 0.08, t.z]}>
              {[3.4, 2.2, 1.2].map((radius, i) => (
                <mesh
                  key={radius}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[0, i * 0.015, 0]}
                >
                  <ringGeometry args={[radius - 0.15, radius, 48]} />
                  <meshBasicMaterial color={i === 2 ? "#ffcf71" : colors[r]} />
                </mesh>
              ))}
              <Lantern position={[0, 0.05, 0]} scale={0.7} />
            </group>
            <Sign
              text={names[r].toUpperCase()}
              p={[p.x, 1.4, p.z - 2]}
              width={2}
            />
            <group position={[p.x + 2.4, 0, p.z]}>
              {[0, 1, 2].map((i) => (
                <Produce
                  key={i}
                  kind="pumpkin"
                  position={[i * 0.5, 0, 0]}
                  scale={0.65}
                />
              ))}
            </group>
          </group>
        );
      })}
      <instancedMesh ref={arc} args={[undefined, undefined, 26]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#ffedbe" />
      </instancedMesh>
      <group ref={shots}>
        {fair.shots.map((shot) => (
          <group key={shot.id}>
            <Produce kind="pumpkin" scale={0.8} />
          </group>
        ))}
      </group>
      <Sign text="THE GLORIOUS PUMPKIN CUP" p={[0, 3, -4]} width={6} />
    </>
  );
}
function WindTowers({ s }: { s: State }) {
  const refs = useRef<(T.Group | null)[]>([]);
  useFrame(({ clock }, dt) => {
    refs.current.forEach((r, i) => {
      if (r) r.rotation.z += dt * (s.towers.includes(i) ? 1.4 : 0.2);
    });
  });
  return (
    <>
      {towers.map((t, i) => (
        <group key={t.id} position={[t.x, 0, t.z]}>
          <Pole p={[0, 3, 0]} h={6} r={0.2} />
          <group
            ref={(el) => {
              refs.current[i] = el;
            }}
            position={[0, 5, 0]}
          >
            {[0, 1, 2, 3].map((j) => (
              <group key={j} rotation={[0, 0, (j * Math.PI) / 2]}>
                <Box p={[0, 0.9, 0]} s={[0.12, 2.5, 0.12]} color="#c3b188" />
                <Box
                  p={[0.35, 1.2, 0.05]}
                  s={[0.7, 1.3, 0.03]}
                  color={s.towers.includes(i) ? "#e8b965" : "#9aaf9f"}
                />
              </group>
            ))}
          </group>
          <Lantern
            position={[0, 2, 0]}
            scale={1.1}
            lit={s.towers.includes(i)}
          />
          {[-3, 3].map((x, j) => (
            <group key={x} position={[x, 0, 0]}>
              <Pole
                p={[0, 0.05, 0]}
                r={1.15}
                h={0.1}
                color={j ? "#72aaa5" : "#c6a064"}
              />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
                <ringGeometry args={[0.85, 1, 32]} />
                <meshBasicMaterial color={j ? "#b8e7df" : "#ffcf82"} />
              </mesh>
              {j === 1 && <Pole p={[0, 0.7, 0]} h={1.4} r={0.08} />}
            </group>
          ))}
          {s.kite?.tower === i && <FlyingKite x={s.kite.x} />}
        </group>
      ))}
    </>
  );
}
function FlyingKite({ x }: { x: number }) {
  const group = useRef<T.Group>(null);
  const current = useRef(x);
  useFrame(({ clock }, dt) => {
    current.current = T.MathUtils.damp(current.current, x, 7, dt);
    if (group.current) {
      group.current.position.set(
        current.current * 6,
        11 + Math.sin(clock.elapsedTime * 2) * 0.12,
        -5,
      );
      group.current.rotation.z =
        -current.current * 0.4 + Math.sin(clock.elapsedTime * 1.6) * 0.035;
    }
  });
  return (
    <group ref={group} position={[x * 6, 11, -5]}>
      <mesh>
        <octahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial
          color="#e9c37f"
          emissive="#d99745"
          emissiveIntensity={0.4}
        />
      </mesh>
      <Pole p={[0, -4, 0]} h={8} r={0.012} color="#f2ddb6" />
    </group>
  );
}
function Meadow({ s }: { s: State }) {
  return (
    <>
      <group position={[0, 0, -4]}>
        <Box p={[0, 1, 0]} s={[4, 0.2, 2]} color="#b49367" />
        {[-1.7, 1.7].map((x) => (
          <Box key={x} p={[x, 0.5, 0]} s={[0.15, 1, 1.6]} />
        ))}
        <Lantern position={[-1, 1.1, 0]} color="#c0ded0" />
        <Lantern position={[0, 1.1, 0]} color="#efbd79" shape={1} />
        <Lantern position={[1, 1.1, 0]} color="#e4aecc" shape={2} />
      </group>
      {lanternStands.map((l, i) => (
        <group key={l.id} position={[l.x, 0, l.z]}>
          <Pole p={[0, 0.55, 0]} h={1.1} r={0.08} />
          <Pole p={[0, 1.12, 0]} h={0.1} r={0.32} color={colors[l.role]} />
          {s.lanterns[l.id] && s.phase === 7 && (
            <Lantern
              position={[0, 1.2, 0]}
              color={lanternColors[s.lanterns[l.id].color]}
              shape={s.lanterns[l.id].shape}
            />
          )}
        </group>
      ))}
      {[-3, 3].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, -43]}>
          <circleGeometry args={[1.2, 32]} />
          <meshStandardMaterial
            color={x < 0 ? colors[0] : colors[1]}
            emissive="#d9c68b"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
    </>
  );
}
function Markers({ targets, role }: { targets: Target[]; role: Role }) {
  const group = useRef<T.Group>(null);
  useFrame(({ clock }) => {
    if (group.current)
      group.current.children.forEach((c, i) => {
        c.position.y = 1.2 + Math.sin(clock.elapsedTime * 1.5 + i) * 0.13;
      });
  });
  return (
    <group ref={group}>
      {targets
        .filter(
          (t) =>
            t.kind !== "ground" && (t.role === undefined || t.role === role),
        )
        .map((t) => (
          <group key={t.id} position={[t.x, 1.2, t.z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry
                args={[t.kind === "collect" ? 0.24 : 0.4, 0.025, 6, 24]}
              />
              <meshBasicMaterial
                color={t.kind === "moth" ? "#bce8cf" : "#ffe1a0"}
                transparent
                opacity={0.85}
              />
            </mesh>
            {t.kind === "moth" && (
              <Orb s={[0.1, 0.1, 0.1]} color="#b0ffe0" glow={3} />
            )}
          </group>
        ))}
    </group>
  );
}
function FloatingLeaves() {
  const leaf = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    x.fillStyle = "#d7ae65";
    x.beginPath();
    x.moveTo(32, 61);
    for (const p of [
      [25, 44],
      [8, 46],
      [15, 31],
      [4, 17],
      [23, 20],
      [22, 5],
      [32, 15],
      [40, 3],
      [43, 22],
      [60, 16],
      [50, 34],
      [56, 45],
      [38, 43],
    ])
      x.lineTo(p[0], p[1]);
    x.closePath();
    x.fill();
    x.strokeStyle = "#654f2d";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(32, 60);
    x.lineTo(32, 17);
    x.stroke();
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => leaf.dispose(), [leaf]);
  const mesh = useRef<T.InstancedMesh>(null);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const o = new T.Object3D();
    for (let i = 0; i < 100; i++) {
      const t = clock.elapsedTime * 0.5 + rand(i) * 20;
      o.position.set(
        (rand(i + 22) - 0.5) * 110 + Math.sin(t + i) * 2,
        12 - ((t * (0.5 + rand(i) * 0.4)) % 12),
        (rand(i + 33) - 0.5) * 100,
      );
      o.rotation.set(t, i + t * 0.3, t * 0.7);
      o.scale.setScalar(0.07 + rand(i) * 0.07);
      o.updateMatrix();
      mesh.current.setMatrixAt(i, o.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 100]}>
      <planeGeometry args={[2, 2]} />
      <meshStandardMaterial
        map={leaf}
        alphaTest={0.4}
        side={T.DoubleSide}
        color="#d49a49"
        roughness={1}
      />
    </instancedMesh>
  );
}
function NightLanterns({ s }: { s: State }) {
  const bodies = useRef<(T.InstancedMesh | null)[]>([]);
  const lights = useRef<(T.Group | null)[]>([]);
  const frames = useRef<T.InstancedMesh>(null);
  const object = useMemo(() => new T.Object3D(), []);
  const reduced = useRef(false);
  const flightTime = useRef<number | null>(null);
  const layout = useMemo(() => {
    const counts = [0, 0, 0];
    const lanterns = Array.from({ length: 42 }, (_, i) => {
      const saved = s.lanterns[`lantern-${i}`];
      const requestedShape = saved?.shape ?? i % 3;
      const shape = requestedShape === 1 ? 1 : requestedShape === 2 ? 2 : 0;
      return {
        i,
        shape,
        slot: counts[shape]++,
        color: lanternColors[saved?.color ?? i % 6],
        lightColor: new T.Color(lanternColors[saved?.color ?? i % 6]).lerp(
          new T.Color("#ffc67c"),
          0.45,
        ),
        scale: 0.6 + rand(i) * 0.6,
      };
    });
    return { counts, lanterns };
  }, [s.lanterns]);
  const paper = useMemo(() => {
    const material = new T.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#ffffff",
      map: paperMap(),
      emissiveMap: paperMap(),
      emissiveIntensity: 0.65,
      roughness: 0.8,
    });
    // Standard instanceColor tints diffuse light only. Carry the same linear
    // color through emission so each personal lantern keeps its original glow.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying vec3 lanternTint;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <color_vertex>",
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          lanternTint = instanceColor;
        #else
          lanternTint = vec3(1.);
        #endif`,
      );
      shader.fragmentShader =
        "varying vec3 lanternTint;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= lanternTint;",
      );
    };
    material.customProgramCacheKey = () => "personal-lantern-instancing-v1";
    finishLanternPaper(material);
    return material;
  }, []);
  useEffect(() => {
    const meshes = [...bodies.current, frames.current];
    return () => {
      paper.dispose();
      // Instancing buffers belong to this flight; shared geometry/maps do not.
      meshes.forEach((mesh) => mesh?.dispose());
    };
  }, [paper]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reduced.current = query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useLayoutEffect(() => {
    const color = new T.Color();
    for (const lantern of layout.lanterns)
      bodies.current[lantern.shape]?.setColorAt(
        lantern.slot,
        color.set(lantern.color),
      );
    for (const mesh of [...bodies.current, frames.current]) {
      if (!mesh) continue;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Conservative bounds cover the complete flight path without rebuilding
      // the bounding sphere on every animation frame.
      mesh.boundingSphere = new T.Sphere(new T.Vector3(0, 20, -26), 65);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    }
  }, [layout]);
  useFrame(({ clock }, dt) => {
    if (!frames.current || document.hidden) return;
    if (flightTime.current === null) flightTime.current = clock.elapsedTime;
    else flightTime.current += dt * (reduced.current ? 0.12 : 1);
    for (const lantern of layout.lanterns) {
      const { i, shape, slot, scale } = lantern;
      const t = flightTime.current * 0.26 + rand(i) * 10;
      object.position.set(
        Math.sin(i * 2.4) * (7 + i * 0.55) + Math.sin(t) * 2,
        4 + ((t * (1 + rand(i))) % 35),
        -26 + Math.cos(i * 2.4) * (7 + i * 0.4),
      );
      object.scale.setScalar(scale);
      const source = lights.current[i];
      if (source) {
        source.position.copy(object.position);
        source.scale.setScalar(scale);
      }
      object.updateMatrix();
      frames.current.setMatrixAt(i, object.matrix);
      object.position.y += 0.4 * scale;
      object.updateMatrix();
      bodies.current[shape]?.setMatrixAt(slot, object.matrix);
    }
    frames.current.instanceMatrix.needsUpdate = true;
    for (const body of bodies.current)
      if (body) body.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh
        name="lantern-cloud-frames"
        ref={frames}
        args={[lanternFrameGeometry(), lanternFrameMaterial(), 42]}
        castShadow
        receiveShadow
        dispose={null}
      />
      {[0, 1, 2].map((shape) => (
        <instancedMesh
          key={shape}
          name={`lantern-cloud-paper-${shape}`}
          ref={(el) => {
            bodies.current[shape] = el;
          }}
          args={[lanternBodyGeometry(shape), paper, 42]}
          count={layout.counts[shape]}
          castShadow
          dispose={null}
        />
      ))}
      {layout.lanterns.map(({ i, lightColor }) => (
        <group
          key={i}
          ref={(el) => {
            lights.current[i] = el;
          }}
        >
          <LocalLightSource
            position={[0, 0.4, 0]}
            color={lightColor}
            radius={0.12}
          />
        </group>
      ))}
      <Sparkles
        count={180}
        scale={[65, 35, 65]}
        position={[0, 12, -20]}
        size={3}
        speed={0.2}
        color="#ffe1a1"
      />
    </>
  );
}
function predictedRiver(s: State) {
  const boat = s.boat;
  if (
    !net.snapshot.peer ||
    net.snapshot.status !== "connected" ||
    (boat.stop < 3 && boat.progress >= riverStops[boat.stop])
  )
    return boat.progress;
  const trim = Math.abs(boat.sail - windAt(boat.progress)),
    speed = trim < 0.24 ? 2.3 : trim < 0.55 ? 1.8 : 1.25;
  return Math.min(
    boat.stop < 3 ? riverStops[boat.stop] : riverLength,
    boat.progress +
      Math.min(
        0.75,
        Math.max(0, (Date.now() + net.clockOffset - boat.at) / 1000),
      ) *
        speed,
  );
}
function River({ s, quality }: { s: State; quality: string }) {
  const boat = useRef<T.Group>(null);
  const sailTime = useMemo(() => ({ value: 0 }), []);
  useFrame(({ clock }, dt) => {
    sailTime.value = clock.elapsedTime;
    if (boat.current) {
      boat.current.position.x = T.MathUtils.damp(
        boat.current.position.x,
        s.boat.x,
        8,
        dt,
      );
      boat.current.position.z = T.MathUtils.damp(
        boat.current.position.z,
        -predictedRiver(s),
        10,
        dt,
      );
      boat.current.rotation.z = Math.sin(performance.now() * 0.0013) * 0.018;
    }
  });
  return (
    <>
      <ReflectiveWater river quality={quality} />
      <Forest river phase={s.phase} />
      <ForestFloor river progress={s.boat.progress} />
      <RiverTerrain />
      {Array.from({ length: 26 }, (_, i) => (
        <group key={i} position={[Math.sin(i * 2.4) * 5, 1, -i * 35]}>
          <mesh>
            <torusGeometry args={[1.6, 0.06, 8, 32]} />
            <meshBasicMaterial
              color={s.boat.glints.includes(i) ? "#668c7d" : "#f9db91"}
            />
          </mesh>
          <Sparkles count={7} scale={[2, 2, 1]} size={3} color="#ffdda4" />
        </group>
      ))}
      {riverStops.map((stop, i) => (
        <group key={i} position={[0, 0, -stop - 6]}>
          <Box p={[9, 0.3, 0]} s={[13, 0.6, 5]} color="#8e704a" />
          <Cottage position={[20, 0, -2]} rotation={-Math.PI / 2} />
          <Sign
            text={["WILLOW BEND", "THE LITTLE LANDING", "MOONWATER"][i]}
            p={[7, 3, 0]}
            width={4}
          />
          <Lantern position={[5, 1, 2]} scale={1.2} />
          <Box p={[7, 1, 0]} s={[1, 0.8, 1]} color="#bd9664" />
        </group>
      ))}
      <group ref={boat} position={[s.boat.x, 0, -s.boat.progress]}>
        <Box p={[0, 0.28, 0]} s={[3.2, 0.4, 5.8]} color="#906640" />
        <Box p={[0, 0.5, -2.8]} s={[2.8, 0.7, 0.3]} color="#a2764b" />
        {[-1.5, 1.5].map((x) => (
          <Box key={x} p={[x, 0.68, 0]} s={[0.2, 0.8, 5.8]} color="#ae8351" />
        ))}
        <Box p={[0, 0.7, 2.8]} s={[3.2, 0.8, 0.2]} color="#a0754a" />
        <Pole p={[0, 2.6, -1.5]} h={5} r={0.08} />
        <mesh position={[0.95, 3.6, -1.5]} rotation={[0, s.boat.sail * 0.6, 0]}>
          <planeGeometry args={[1.8, 2.1, 16, 16]} />
          <meshStandardMaterial
            color="#e3d2a5"
            onBeforeCompile={(shader) => {
              shader.uniforms.sailTime = sailTime;
              shader.vertexShader =
                "uniform float sailTime;\n" + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
                float fullness=sin(uv.x*3.14159)*sin(uv.y*3.14159);
                transformed.z+=fullness*(.28+sin(sailTime*2.2+uv.y*5.)*.05);`,
              );
            }}
            side={T.DoubleSide}
            roughness={1}
          />
        </mesh>
        <Lantern position={[-1, 0.7, -2]} />
        <Sign text="ALMOST SENSIBLE" p={[0, 0.65, 2.94]} width={2.7} />
      </group>
      <Sparkles
        count={100}
        scale={[25, 8, 110]}
        position={[0, 3, -s.boat.progress - 30]}
        size={3}
        speed={0.1}
        color="#efd09a"
      />
    </>
  );
}
function PeerVideo() {
  const ref = useRef<HTMLVideoElement>(null),
    [, update] = useState(0);
  useEffect(() => {
    const f = () => update((n) => n + 1);
    media.addEventListener("change", f);
    return () => media.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = media.remote;
      void ref.current.play().catch(() => {});
    }
  }, [media.remote, media.remoteCamera, media.healthy]);
  return (
    <div className={`ll-world-video ${!media.remoteCamera ? "name-only" : ""}`}>
      {media.remoteCamera ? (
        media.healthy ? (
          <video ref={ref} muted autoPlay playsInline />
        ) : media.frame ? (
          <img src={media.frame} alt="Your Mingy’s live camera" />
        ) : (
          <span>{names[1 - net.snapshot.role]}</span>
        )
      ) : (
        <span>{names[1 - net.snapshot.role]}</span>
      )}
      <i className={net.snapshot.peer ? "online" : ""} />
    </div>
  );
}
function Player({
  s,
  role,
  targets,
  onNear,
  paused,
  focus,
}: {
  s: State;
  role: Role;
  targets: Target[];
  onNear: (t: Target | null) => void;
  paused: boolean;
  focus?: "journal" | "craft" | "chapter" | null;
}) {
  const { camera, gl } = useThree();
  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const remote = useRef<T.Group>(null),
    self = useRef<T.Group>(null),
    hand = useRef<T.Group>(null);
  const pos = useRef(new T.Vector3(net.local.x, net.local.y, net.local.z)),
    velocity = useRef(0),
    lastSent = useRef(0),
    lastStep = useRef(0),
    lastNear = useRef(""),
    scene = useRef(net.local.scene),
    planar = useRef(new T.Vector2()),
    view = useRef(new T.Vector2(input.yaw, input.pitch)),
    jumpHeld = useRef(false),
    stride = useRef(0),
    eyeVec = useRef(new T.Vector3()),
    cameraVec = useRef(new T.Vector3()),
    peerVec = useRef(new T.Vector3()),
    thirdBlend = useRef(input.third ? 1 : 0);
  const river = s.phase === 3 && s.boarded.length === 2;
  const hollow = s.phase === 9;
  const [peerMoving, setPeerMoving] = useState(false),
    [showSelf, setShowSelf] = useState(false);
  useEffect(() => {
    const welcome = () => {
      pos.current.set(net.local.x, net.local.y, net.local.z);
      input.yaw = net.local.yaw;
      input.pitch = net.local.pitch;
      view.current.set(input.yaw, input.pitch);
      planar.current.set(0, 0);
    };
    welcome();
    net.addEventListener("welcome", welcome);
    return () => net.removeEventListener("welcome", welcome);
  }, []);
  useEffect(() => {
    const desired = hollow ? "hollow" : river ? "river" : "valley";
    if (scene.current !== desired) {
      scene.current = desired;
      if (hollow) {
        const start = hollowSpawn(role);
        pos.current.set(start.x, start.y, start.z);
        input.yaw = input.pitch = 0;
        view.current.set(0, 0);
      } else if (!river) {
        pos.current.set(role ? 2 : -2, 0, 34);
        input.yaw = input.pitch = 0;
        view.current.set(0, 0);
      } else {
        input.yaw = 0;
        input.pitch = 0;
      }
    }
    planar.current.set(0, 0);
  }, [river, hollow, role]);
  useEffect(() => {
    const canvas = gl.domElement;
    const down = (e: MouseEvent) => {
      if (input.blocked) return;
      if (e.button === 0) {
        input.look = true;
        void canvas.requestPointerLock?.()?.catch?.(() => {});
      }
      if (e.button === 2) input.look = true;
    };
    const context = (e: Event) => e.preventDefault();
    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("contextmenu", context);
    canvas.addEventListener("wheel", trackpadLook, { passive: false });
    return () => {
      canvas.removeEventListener("mousedown", down);
      canvas.removeEventListener("contextmenu", context);
      canvas.removeEventListener("wheel", trackpadLook);
    };
  }, [gl]);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05),
      t = clock.elapsedTime;
    const p = pos.current;
    let moving = false;
    const beforeX = p.x,
      beforeZ = p.z;
    const groundedFloor =
      !hollow && s.bridge >= 6 && Math.abs(p.x) < 2 && p.z < -56 && p.z > -79
        ? 0.35
        : 0;
    const operating =
      hollow &&
      (s.expedition.operator?.role === role ||
        s.expedition.receiver?.role === role);
    const carrying =
      hollow &&
      !s.expedition.carry.delivered &&
      s.expedition.carry.holders.includes(role);
    const canWalk =
      !river && !input.blocked && s.kite?.role !== role && !operating;
    let f = 0,
      side = 0;
    if (canWalk) {
      f =
        (input.keys.has("KeyW") || input.keys.has("ArrowUp") ? 1 : 0) -
        (input.keys.has("KeyS") || input.keys.has("ArrowDown") ? 1 : 0) -
        input.touch.z;
      side =
        (input.keys.has("KeyD") || input.keys.has("ArrowRight") ? 1 : 0) -
        (input.keys.has("KeyA") || input.keys.has("ArrowLeft") ? 1 : 0) +
        input.touch.x;
    }
    const len = Math.max(1, Math.hypot(f, side)),
      speed = carrying ? 2.35 : input.keys.has("ShiftLeft") ? 6.8 : 4.4;
    const targetX =
      ((-Math.sin(input.yaw) * f + Math.cos(input.yaw) * side) / len) * speed;
    const targetZ =
      ((-Math.cos(input.yaw) * f - Math.sin(input.yaw) * side) / len) * speed;
    planar.current.x = T.MathUtils.damp(
      planar.current.x,
      targetX,
      canWalk ? 14 : 24,
      dt,
    );
    planar.current.y = T.MathUtils.damp(
      planar.current.y,
      targetZ,
      canWalk ? 14 : 24,
      dt,
    );
    const clear = (x: number, z: number) => {
      if (hollow) {
        if (Math.abs(x) > expeditionBounds || Math.abs(z) > expeditionBounds)
          return false;
        if (
          hollowObstacles.some(
            (b) => Math.abs(x - b.x) < b.w && Math.abs(z - b.z) < b.d,
          )
        )
          return false;
        if (
          carrying &&
          Math.hypot(x - s.expedition.carry.x, z - s.expedition.carry.z) >
            4.2 &&
          Math.hypot(x - s.expedition.carry.x, z - s.expedition.carry.z) >=
            Math.hypot(p.x - s.expedition.carry.x, p.z - s.expedition.carry.z)
        )
          return false;
        return true;
      }
      if (
        Math.abs(x) > 83 ||
        Math.abs(z) > 83 ||
        (z < -59 && z > -75 && !(s.bridge >= 6 && Math.abs(x) < 1.6))
      )
        return false;
      return !obstacles.some(
        (b) => Math.abs(x - b.x) < b.w && Math.abs(z - b.z) < b.d,
      );
    };
    if (!river && !input.blocked) {
      if (clear(p.x + planar.current.x * dt, p.z)) p.x += planar.current.x * dt;
      else planar.current.x = 0;
      if (clear(p.x, p.z + planar.current.y * dt)) p.z += planar.current.y * dt;
      else planar.current.y = 0;
    }
    const jump = input.keys.has("Space");
    if (
      canWalk &&
      !carrying &&
      (input.jumpQueued || (jump && !jumpHeld.current)) &&
      p.y <= groundedFloor + 0.01
    )
      velocity.current = 4.8;
    input.jumpQueued = false;
    jumpHeld.current = jump;
    if (!river) {
      velocity.current -= 12 * dt;
      p.y = Math.max(groundedFloor, p.y + velocity.current * dt);
      if (p.y === groundedFloor) velocity.current = 0;
    }
    const distance = Math.hypot(p.x - beforeX, p.z - beforeZ);
    moving = distance / dt > 0.12;
    stride.current += distance * 2.8;
    if (
      moving &&
      t - lastStep.current > (speed > 5 ? 0.29 : 0.43) &&
      p.y <= groundedFloor + 0.02
    ) {
      sound.step(
        groundedFloor > 0 ? "wood" : Math.abs(p.x) < 3.5 ? "gravel" : "leaves",
      );
      lastStep.current = t;
    }
    const bob =
      moving && !input.third && !reduced
        ? Math.sin(stride.current * 2) * 0.018
        : 0;
    const eye = eyeVec.current.set(
      river ? s.boat.x + (role === 0 ? -0.65 : 0.65) : p.x,
      river ? 2.2 : p.y + 1.65 + bob,
      river ? -predictedRiver(s) + 1.15 : p.z,
    );
    view.current.x +=
      Math.atan2(
        Math.sin(input.yaw - view.current.x),
        Math.cos(input.yaw - view.current.x),
      ) *
      (1 - Math.exp(-dt * 32));
    view.current.y = T.MathUtils.damp(view.current.y, input.pitch, 32, dt);
    camera.rotation.order = "YXZ";
    camera.rotation.set(view.current.y, view.current.x, 0);
    thirdBlend.current = T.MathUtils.damp(
      thirdBlend.current,
      input.third ? 1 : 0,
      reduced ? 100 : 9,
      dt,
    );
    const offset = cameraVec.current
      .set(Math.sin(view.current.x) * 4.5, 1.3, Math.cos(view.current.x) * 4.5)
      .multiplyScalar(thirdBlend.current);
    // Pull the camera forward before it can enter a cottage wall.
    if (thirdBlend.current > 0.01 && !river) {
      for (let d = 0.1; d <= 1; d += 0.05) {
        if (!clear(eye.x + offset.x * d, eye.z + offset.z * d)) {
          offset.multiplyScalar(Math.max(0, d - 0.1));
          break;
        }
      }
    }
    const cameraTarget = peerVec.current.copy(eye).add(offset);
    camera.position.lerp(cameraTarget, river ? 1 - Math.exp(-dt * 12) : 1);
    if (thirdBlend.current > 0.5) camera.lookAt(eye.x, eye.y - 0.2, eye.z);
    const perspective = camera as T.PerspectiveCamera;
    const desiredFov =
      focus === "journal"
        ? 59
        : focus === "craft"
          ? 61
          : focus === "chapter"
            ? 64
            : moving && speed > 5
              ? 74
              : 70;
    const fov = T.MathUtils.damp(perspective.fov, desiredFov, 5, dt);
    if (Math.abs(fov - perspective.fov) > 0.005) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
    if (self.current) {
      self.current.visible = input.third;
      self.current.position.set(
        river ? s.boat.x - 0.65 + role * 1.3 : p.x,
        river ? 0.5 : p.y,
        river ? -predictedRiver(s) + 1.15 : p.z,
      );
      self.current.rotation.y = input.yaw + Math.PI;
    }
    if (showSelf !== input.third) setShowSelf(input.third);
    const peer = net.motion.sample(performance.now()) || net.poses[1 - role];
    if (remote.current) {
      remote.current.visible =
        !!peer &&
        net.snapshot.peer &&
        (river
          ? peer.scene === "river"
          : peer.scene === (hollow ? "hollow" : "valley"));
      if (peer) {
        const target = peerVec.current.set(
          river ? s.boat.x + (role === 0 ? 0.65 : -0.65) : peer.x,
          river ? 0.5 : peer.y,
          river ? -predictedRiver(s) + 1.15 : peer.z,
        );
        if (remote.current.position.distanceTo(target) > 12)
          remote.current.position.copy(target);
        else remote.current.position.lerp(target, 1 - Math.exp(-dt * 30));
        let diff =
          T.MathUtils.euclideanModulo(
            peer.yaw + Math.PI - remote.current.rotation.y + Math.PI,
            Math.PI * 2,
          ) - Math.PI;
        remote.current.rotation.y += diff * (1 - Math.exp(-dt * 12));
        if (peerMoving !== peer.moving) setPeerMoving(peer.moving);
      }
    }
    if (hand.current) {
      hand.current.visible = !input.third && !river;
      hand.current.position.copy(camera.position);
      hand.current.quaternion.copy(camera.quaternion);
      const held = hand.current.children[0];
      if (held) {
        const actionAge = (Date.now() + net.clockOffset - net.gestureAt) / 1000;
        const reach =
          actionAge >= 0 && actionAge < 0.8
            ? Math.sin((actionAge / 0.8) * Math.PI)
            : 0;
        held.position.x =
          0.36 + Math.sin(stride.current) * Math.min(0.024, distance * 3);
        held.position.y = T.MathUtils.damp(
          held.position.y,
          focus
            ? -0.9
            : -0.42 +
                Math.cos(stride.current * 2) * Math.min(0.014, distance * 2) +
                reach * 0.12,
          9,
          dt,
        );
        held.position.z = -0.78 - reach * 0.15;
        held.rotation.x = 0.2 - reach * 0.35;
        held.rotation.z = -side * 0.04 + Math.sin(t * 1.4) * 0.014;
      }
    }
    if (t - lastSent.current > 0.05) {
      lastSent.current = t;
      net.move({
        x: river ? s.boat.x : p.x,
        y: river ? 0 : p.y,
        z: river ? 0 : p.z,
        yaw: input.yaw,
        pitch: input.pitch,
        moving,
        time: Date.now() + net.clockOffset,
        seq: net.local.seq + 1,
        scene: hollow ? "hollow" : river ? "river" : "valley",
      });
      let nearest: Target | null = null,
        best = 3.8;
      if (!river)
        for (const target of targets) {
          if (target.role !== undefined && target.role !== role) continue;
          if (target.action === "exp-guide") continue;
          const d = Math.hypot(target.x - p.x, target.z - p.z);
          if (d < best) {
            best = d;
            nearest = target;
          }
        }
      const nearKey = nearest
        ? `${nearest.id}:${nearest.label}:${nearest.action || ""}`
        : "";
      if (nearKey !== lastNear.current) {
        lastNear.current = nearKey;
        onNear(nearest);
      }
    }
  });
  return (
    <>
      <group ref={self} name="local-avatar">
        <Character
          role={role}
          pose={() => net.local}
          held={s.bags[role]?.[0]}
          lantern={s.hands[role]}
        />
      </group>
      <group ref={remote}>
        <Character
          role={(1 - role) as Role}
          pose={() =>
            net.motion.sample(performance.now()) || net.poses[1 - role]
          }
          held={s.bags[1 - role]?.[0]}
          lantern={s.hands[1 - role]}
        />
        <Html
          position={[0, 2.55, 0]}
          center
          style={{ pointerEvents: "none" }}
          zIndexRange={[20, 0]}
        >
          <PeerVideo />
        </Html>
      </group>
      <group ref={hand} name="first-person-hands">
        <group position={[0.36, -0.42, -0.78]} rotation={[0.2, -0.3, 0]}>
          <HeldObjectRig s={s} role={role} />
        </group>
      </group>
    </>
  );
}
function Scene({
  s,
  role,
  onNear,
  paused,
  quality,
  focus,
}: {
  s: State;
  role: Role;
  onNear: (t: Target | null) => void;
  paused: boolean;
  quality: string;
  focus?: "journal" | "craft" | "chapter" | null;
}) {
  const targets = useMemo(() => targetsFor(s, role), [s, role]);
  const river = s.phase === 3 && s.boarded.length === 2,
    hollow = s.phase === 9,
    night = s.phase >= 6;
  const { scene, gl } = useThree();
  const sun = useRef<T.DirectionalLight>(null),
    hemisphere = useRef<T.HemisphereLight>(null);
  const lightTarget = useMemo(() => new T.Object3D(), []);
  const dusk = useRef(night ? 1 : 0);
  const moonMap = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const x = canvas.getContext("2d")!;
    x.fillStyle = "#dfd7c1";
    x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 440; i++) {
      const px = rand(i + 100) * 1024,
        py = rand(i + 500) * 512,
        r = 2 + Math.pow(rand(i + 700), 4) * 68;
      const g = x.createRadialGradient(
        px - r * 0.12,
        py - r * 0.1,
        r * 0.12,
        px,
        py,
        r,
      );
      g.addColorStop(0, i % 4 ? "#a69d8970" : "#6f766b65");
      g.addColorStop(0.72, "#aaa38f45");
      g.addColorStop(0.85, "#ede4c74a");
      g.addColorStop(1, "#dfd7c100");
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    const t = new T.CanvasTexture(canvas);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => moonMap.dispose(), [moonMap]);
  const dayFog = useMemo(() => new T.Color("#b9c0bd"), []),
    nightFog = useMemo(() => new T.Color("#263c44"), []);
  const dayLight = useMemo(() => new T.Color("#ffe1ab"), []),
    nightLight = useMemo(() => new T.Color("#8fa9cd"), []);
  useEffect(() => {
    gl.toneMapping = T.ACESFilmicToneMapping;
    scene.fog = new T.Fog(dayFog, 75, 200);
    scene.background = dayFog.clone();
    scene.add(lightTarget);
    if (sun.current) sun.current.target = lightTarget;
    return () => {
      scene.remove(lightTarget);
    };
  }, [gl, scene, dayFog, lightTarget]);
  useFrame((_, dt) => {
    dusk.current = T.MathUtils.damp(dusk.current, night ? 1 : 0, 0.32, dt);
    const v = dusk.current;
    gl.toneMappingExposure = T.MathUtils.lerp(1.12, 1.2, v);
    if (scene.fog instanceof T.Fog) {
      scene.fog.color.copy(dayFog).lerp(nightFog, v);
      scene.fog.near = T.MathUtils.lerp(75, 45, v);
    }
    if (sun.current) {
      sun.current.color.copy(dayLight).lerp(nightLight, v);
      sun.current.intensity = T.MathUtils.lerp(2.6, 0.9, v);
      const z = river ? -predictedRiver(s) : 0;
      sun.current.position.set(
        T.MathUtils.lerp(-92, 65, v),
        T.MathUtils.lerp(15, 49, v),
        T.MathUtils.lerp(-75, -110, v) + z,
      );
      lightTarget.position.set(0, 0, z);
      lightTarget.updateMatrixWorld();
    }
    if (hemisphere.current)
      hemisphere.current.intensity = T.MathUtils.lerp(0.4, 0.65, v);
  });
  return (
    <>
      <LocalLightingProvider quality={quality}>
        <RealSky night={night} rotation={Math.PI} />
        <hemisphereLight
          ref={hemisphere}
          args={[
            night ? "#b6ccd6" : "#d9e4e2",
            night ? "#4d4740" : "#8c7757",
            night ? 0.65 : 0.4,
          ]}
        />
        <ambientLight intensity={night ? 0.2 : 0.05} />
        <directionalLight
          ref={sun}
          position={[-92, 15, -75]}
          intensity={night ? 0.9 : 2.6}
          color={night ? "#8fa9cd" : "#ffe1ab"}
          castShadow={quality !== "low"}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-70}
          shadow-camera-right={70}
          shadow-camera-top={70}
          shadow-camera-bottom={-70}
          shadow-camera-far={260}
          shadow-bias={-0.0004}
          shadow-normalBias={0.06}
        />
        {night && (
          <mesh
            position={river ? [40, 35, -s.boat.progress - 130] : [65, 49, -110]}
          >
            <sphereGeometry args={[7, 32, 24]} />
            <meshBasicMaterial map={moonMap} color="#f1dcb6" fog={false} />
          </mesh>
        )}
        {night && (
          <Stars
            radius={160}
            depth={70}
            count={1700}
            factor={3}
            saturation={0.1}
            fade
            speed={0.15}
          />
        )}
        {hollow ? (
          <>
            <ExpeditionWorld expedition={s.expedition} quality={quality} />
            <Markers targets={targets} role={role} />
          </>
        ) : river ? (
          <River s={s} quality={quality} />
        ) : (
          <>
            <Landscape />
            <ScenicBackdrop night={night} quality={quality} />
            <ReflectiveWater quality={quality} night={night} />
            <Forest phase={s.phase} />
            <ForestFloor />
            <Wildlife s={s} quality={quality} />
            <Village s={s} />
            <FloatingLeaves />
            <HarvestEffects s={s} />
            {s.phase <= 2 &&
              props
                .filter(
                  (p) => p.phase === s.phase && !s.collected.includes(p.id),
                )
                .map((p) => (
                  <Produce
                    key={p.id}
                    kind={p.kind}
                    position={[p.x, 0.04, p.z]}
                  />
                ))}
            {s.phase === 0 &&
              [0, 1].map((r) => (
                <group key={r} position={[r ? 3 : -3, 0, 32]}>
                  <Pole p={[0, 0.6, 0]} h={1.2} r={0.14} />
                  <Lantern
                    position={[0, 1.2, 0]}
                    color={colors[r]}
                    lit={s.ready.includes(r)}
                  />
                </group>
              ))}
            {s.phase >= 4 && s.phase !== 6 && s.phase !== 5 && (
              <Kitchen s={s} />
            )}
            {s.phase === 5 && <Carnival s={s} role={role} />}
            <WindTowers s={s} />
            {s.phase >= 7 && <Meadow s={s} />}
            <Markers targets={targets} role={role} />
            {night && (
              <Sparkles
                count={100}
                scale={[90, 8, 90]}
                position={[0, 3, 0]}
                size={3}
                speed={0.3}
                color="#ffdb9a"
              />
            )}
            {s.phase === 8 && <NightLanterns s={s} />}
          </>
        )}
        {!hollow && <WorldDetails s={s} river={river} />}
        {!hollow && (
          <EnvironmentResponse s={s} river={river} quality={quality} />
        )}
        <WoodlandAudio river={river} hollow={hollow} />
        <Player
          s={s}
          role={role}
          targets={targets}
          onNear={onNear}
          paused={paused}
          focus={focus}
        />
        {quality === "high" && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.22} luminanceThreshold={1.3} mipmapBlur />
            <Vignette eskil={false} offset={0.22} darkness={0.16} />
          </EffectComposer>
        )}
      </LocalLightingProvider>
    </>
  );
}
function World(props: {
  s: State;
  role: Role;
  onNear: (t: Target | null) => void;
  paused: boolean;
  quality: string;
  focus?: "journal" | "craft" | "chapter" | null;
}) {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    if (props.s.phase === 4 || props.s.phase === 5) {
      // Fetch the next setting during the preceding chapter; its scene still
      // mounts only on arrival, with the chapter card covering shader warmup.
      void import("./ExpeditionWorld").catch(() => {});
    }
  }, [props.s.phase]);
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  return (
    <Canvas
      shadows={props.quality !== "low" ? "percentage" : false}
      dpr={dpr}
      frameloop={frameloop}
      camera={{ fov: 70, near: 0.08, far: 350 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl, scene, camera }) => {
        if (import.meta.env.DEV)
          Object.assign((window as any).__autumn, {
            renderInfo: gl.info,
            scene,
            camera,
            renderer: gl,
          });
        gl.domElement.setAttribute(
          "aria-label",
          "First-person Bramblewick game world",
        );
      }}
    >
      <RenderBudget
        scenePhase={props.s.phase}
        quality={props.quality}
        onDprChange={setDpr}
        onFrameloopChange={setFrameloop}
      />
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}
export default memo(World);
