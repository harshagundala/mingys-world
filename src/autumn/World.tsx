import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Stars, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as T from "three";
import { net } from "./network";
import { media } from "./media";
import { input } from "./controls";
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
  Avatar,
  Box,
  Cottage,
  Forest,
  Lantern,
  Orb,
  Pole,
  Produce,
  Sign,
  mat,
} from "./Models";
export type Target = {
  id: string;
  label: string;
  kind: string;
  x: number;
  z: number;
  role?: Role;
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
function Atmosphere({
  night,
  river,
  progress,
}: {
  night: boolean;
  river: boolean;
  progress: number;
}) {
  const material = useRef<T.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ night: { value: night ? 1 : 0 }, time: { value: 0 } }),
    [night],
  );
  useFrame(({ clock }) => {
    if (material.current)
      material.current.uniforms.time.value = clock.elapsedTime * 0.002;
  });
  return (
    <mesh position={[0, 0, river ? -progress : 0]}>
      <sphereGeometry args={[300, 32, 24]} />
      <shaderMaterial
        ref={material}
        side={T.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec3 v;uniform float night;uniform float time;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(4.3);a*=.5;}return s;}
 void main(){vec3 d=normalize(v);float y=max(d.y,0.);vec3 horizon=mix(vec3(.78,.77,.65),vec3(.16,.25,.29),night);vec3 zenith=mix(vec3(.31,.49,.56),vec3(.035,.09,.14),night);vec3 col=mix(horizon,zenith,pow(y,.45));vec3 sun=normalize(vec3(.5,.34,-.75));float dotSun=max(0.,dot(d,sun));col+=vec3(1.,.66,.3)*pow(dotSun,22.)*.18*(1.-night);col+=vec3(1.,.8,.5)*smoothstep(.998,.9995,dotSun)*(1.-night);vec2 uv=d.xz/max(.18,y)*1.4+time;float cloud=smoothstep(.52,.73,fbm(uv))*smoothstep(.02,.2,y);col=mix(col,mix(vec3(.91,.85,.7),vec3(.21,.29,.33),night),cloud*.75);gl_FragColor=vec4(col,1.);}`}
      />
    </mesh>
  );
}
function Ground() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#889367";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 35000; i++) {
      const r = rand(i + 700);
      ctx.fillStyle = `rgba(${r > 0.5 ? "210,187,116" : "51,70,43"},${0.04 + r * 0.13})`;
      ctx.fillRect(
        rand(i + 1) * 512,
        rand(i + 2) * 512,
        1 + rand(i + 3) * 3,
        1 + rand(i + 4) * 5,
      );
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(48, 48);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[360, 360]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 16]}
        receiveShadow
      >
        <planeGeometry args={[7, 85]} />
        <meshStandardMaterial color="#bdab84" roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, -0.63]}
        position={[-15, 0.015, 4]}
        receiveShadow
      >
        <planeGeometry args={[4, 53]} />
        <meshStandardMaterial color="#b5a582" roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0.75]}
        position={[16, 0.018, -9]}
        receiveShadow
      >
        <planeGeometry args={[4, 50]} />
        <meshStandardMaterial color="#b7a587" roughness={1} />
      </mesh>
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return (
          <Orb
            key={i}
            p={[Math.cos(a) * 140, -10, Math.sin(a) * 140]}
            s={[
              45 + rand(i) * 35,
              30 + rand(i + 33) * 35,
              35 + rand(i + 45) * 30,
            ]}
            color={i % 2 ? "#6f8071" : "#7b8d79"}
          />
        );
      })}
    </>
  );
}
function Water({ river = false }: { river?: boolean }) {
  const ref = useRef<T.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      deep: { value: new T.Color("#245b60") },
      light: { value: new T.Color("#9bbab0") },
    }),
    [],
  );
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.time.value = clock.elapsedTime;
  });
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.06, river ? -350 : -68]}
    >
      <planeGeometry args={river ? [34, 1800, 12, 160] : [320, 20, 70, 12]} />
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; varying vec3 vPos; uniform float time; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.6+time*.7)*.045+cos(p.y*.7-time*.5)*.04;vPos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`}
        fragmentShader={`varying vec2 vUv; varying vec3 vPos; uniform float time;uniform vec3 deep;uniform vec3 light;void main(){float w=sin(vPos.x*1.8+sin(vPos.y*.8+time)*1.7+time)*cos(vPos.y*2.3-time*.9);float r=pow(max(0.,w),10.);float bands=sin(vPos.y*.7+time*.5)*.06;gl_FragColor=vec4(mix(deep,light,.15+bands+r*.5),1.);}`}
      />
    </mesh>
  );
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
      <group position={[0, 0, -58]}>
        <Box p={[0, 0.18, 0]} s={[7, 0.36, 4]} color="#8c7250" />
        {Array.from({ length: s.bridge }, (_, i) => (
          <group key={i} position={[0, 0, -3 - i * 2.5]}>
            <Box p={[0, 0.18, 0]} s={[4, 0.3, 2.5]} color="#ad8755" />
            {[-2, 2].map((x) => (
              <group key={x}>
                <Pole p={[x, 0.8, 0]} r={0.09} h={1.6} />
                <Box p={[x, 1.4, 0]} s={[0.12, 0.12, 2.5]} />
              </group>
            ))}
          </group>
        ))}
      </group>
      <group position={[0, 0, 13]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.3, 1.65, 20]} />
          <meshStandardMaterial color="#7b7565" />
        </mesh>
        <Produce kind="wood" position={[0, 0.12, 0]} />
        <Orb p={[0, 0.55, 0]} s={[0.35, 0.7, 0.35]} color="#ffae58" glow={2} />
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
      {tables.map((p, i) => (
        <group key={p.id} position={[p.x, 0, p.z]}>
          <Pole p={[0, 0.5, 0]} r={0.12} h={1} />
          <Pole p={[0, 1, 0]} r={1.4} h={0.15} color="#c3a576" />
          <Lantern position={[0, 1.1, 0]} scale={0.6} />
          {i < s.order && (
            <Orb p={[0.5, 1.12, 0.2]} s={[0.35, 0.04, 0.35]} color="#e1d4b1" />
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
          {s.kite?.tower === i && (
            <group
              position={[s.kite.x * 6, 11, -5]}
              rotation={[0, 0, -s.kite.x * 0.4]}
            >
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
          )}
        </group>
      ))}
    </>
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
      <octahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#d49a49" roughness={1} />
    </instancedMesh>
  );
}
function NightLanterns() {
  const refs = useRef<(T.Group | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((r, i) => {
      if (r) {
        const t = clock.elapsedTime * 0.26 + rand(i) * 10;
        r.position.set(
          Math.sin(i * 2.4) * (7 + i * 0.55) + Math.sin(t) * 2,
          4 + ((t * (1 + rand(i))) % 35),
          -26 + Math.cos(i * 2.4) * (7 + i * 0.4),
        );
      }
    });
  });
  return (
    <>
      {Array.from({ length: 42 }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <Lantern
            color={lanternColors[i % 6]}
            scale={0.6 + rand(i) * 0.6}
            shape={i % 3}
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
function River({ s }: { s: State }) {
  const boat = useRef<T.Group>(null);
  useFrame((_, dt) => {
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
      <Water river />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            p={[side * 50, -0.6, -360]}
            s={[65, 1.2, 1700]}
            color="#898e62"
          />
          {Array.from({ length: 110 }, (_, i) => (
            <group
              key={i}
              position={[side * (19 + rand(i + 70) * 23), 0, 70 - i * 10]}
            >
              <Pole p={[0, 3, 0]} h={6} r={0.35} />
              <Orb
                p={[0, 6, 0]}
                s={[3 + rand(i), 3, 3]}
                color={["#9b6b3e", "#b98443", "#b85d39", "#738473"][i % 4]}
              />
              {i % 4 === 0 && (
                <Lantern position={[side * -3, 1, 0]} scale={1.3} />
              )}
            </group>
          ))}
        </group>
      ))}
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
          <planeGeometry args={[1.8, 2.1, 8, 8]} />
          <meshStandardMaterial
            color="#e3d2a5"
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
}: {
  s: State;
  role: Role;
  targets: Target[];
  onNear: (t: Target | null) => void;
  paused: boolean;
}) {
  const { camera, gl } = useThree();
  const remote = useRef<T.Group>(null),
    self = useRef<T.Group>(null),
    hand = useRef<T.Group>(null);
  const pos = useRef(new T.Vector3(net.local.x, net.local.y, net.local.z)),
    velocity = useRef(0),
    lastSent = useRef(0),
    lastStep = useRef(0),
    lastNear = useRef(""),
    scene = useRef("valley");
  const river = s.phase === 3 && s.boarded.length === 2;
  const [peerMoving, setPeerMoving] = useState(false),
    [showSelf, setShowSelf] = useState(false);
  useEffect(() => {
    const welcome = () => {
      pos.current.set(net.local.x, net.local.y, net.local.z);
      input.yaw = net.local.yaw;
      input.pitch = net.local.pitch;
    };
    net.addEventListener("welcome", welcome);
    return () => net.removeEventListener("welcome", welcome);
  }, []);
  useEffect(() => {
    const desired = river ? "river" : "valley";
    if (scene.current !== desired) {
      scene.current = desired;
      if (!river) pos.current.set(role ? 2 : -2, 0, 34);
      else {
        input.yaw = 0;
        input.pitch = 0;
      }
    }
  }, [river, role]);
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
    return () => {
      canvas.removeEventListener("mousedown", down);
      canvas.removeEventListener("contextmenu", context);
    };
  }, [gl]);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05),
      t = clock.elapsedTime;
    const p = pos.current;
    let moving = false;
    if (!river && !input.blocked && s.kite?.role !== role) {
      const f =
        (input.keys.has("KeyW") || input.keys.has("ArrowUp") ? 1 : 0) -
        (input.keys.has("KeyS") || input.keys.has("ArrowDown") ? 1 : 0) -
        input.touch.z;
      const side =
        (input.keys.has("KeyD") || input.keys.has("ArrowRight") ? 1 : 0) -
        (input.keys.has("KeyA") || input.keys.has("ArrowLeft") ? 1 : 0) +
        input.touch.x;
      const len = Math.max(1, Math.hypot(f, side)),
        speed = input.keys.has("ShiftLeft") ? 6.8 : 4.4;
      const dx =
          ((-Math.sin(input.yaw) * f + Math.cos(input.yaw) * side) / len) *
          speed *
          dt,
        dz =
          ((-Math.cos(input.yaw) * f - Math.sin(input.yaw) * side) / len) *
          speed *
          dt;
      const clear = (x: number, z: number) => {
        if (
          Math.abs(x) > 83 ||
          Math.abs(z) > 83 ||
          (z < -59 && z > -75 && !(s.bridge >= 6 && Math.abs(x) < 1.6))
        )
          return false;
        for (const b of obstacles)
          if (Math.abs(x - b.x) < b.w && Math.abs(z - b.z) < b.d) return false;
        return true;
      };
      if (clear(p.x + dx, p.z)) p.x += dx;
      if (clear(p.x, p.z + dz)) p.z += dz;
      moving = Math.abs(dx) + Math.abs(dz) > 0.002;
      const floor =
        s.bridge >= 6 && Math.abs(p.x) < 2 && p.z < -56 && p.z > -75 ? 0.35 : 0;
      if (input.keys.has("Space") && p.y <= floor + 0.01)
        velocity.current = 4.8;
      velocity.current -= 12 * dt;
      p.y = Math.max(floor, p.y + velocity.current * dt);
      if (p.y === floor) velocity.current = 0;
      if (moving && t - lastStep.current > 0.42 && p.y === 0) {
        sound.step();
        lastStep.current = t;
      }
    }
    const bob = moving && !input.third ? Math.sin(t * 10) * 0.025 : 0;
    const eye = new T.Vector3(
      river ? s.boat.x + (role === 0 ? -0.65 : 0.65) : p.x,
      river ? 2.2 : p.y + 1.65 + bob,
      river ? -predictedRiver(s) + 1.15 : p.z,
    );
    camera.rotation.order = "YXZ";
    camera.rotation.set(input.pitch, input.yaw, 0);
    if (input.third) {
      const offset = new T.Vector3(0, 1.3, 4.5).applyAxisAngle(
        new T.Vector3(0, 1, 0),
        input.yaw,
      );
      camera.position.copy(eye).add(offset);
      camera.lookAt(eye.x, eye.y - 0.2, eye.z);
    } else camera.position.lerp(eye, river ? Math.min(1, dt * 10) : 1);
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
    const peer = net.poses[1 - role];
    if (remote.current) {
      remote.current.visible =
        !!peer && net.snapshot.peer && (river || peer.scene === "valley");
      if (peer) {
        const target = new T.Vector3(
          river ? s.boat.x + (role === 0 ? 0.65 : -0.65) : peer.x,
          river ? 0.5 : peer.y,
          river ? -predictedRiver(s) + 1.15 : peer.z,
        );
        if (remote.current.position.distanceTo(target) > 12)
          remote.current.position.copy(target);
        else remote.current.position.lerp(target, 1 - Math.exp(-dt * 15));
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
        scene: river ? "river" : "valley",
      });
      let nearest: Target | null = null,
        best = 3.8;
      if (!river)
        for (const target of targets) {
          if (target.role !== undefined && target.role !== role) continue;
          const d = Math.hypot(target.x - p.x, target.z - p.z);
          if (d < best) {
            best = d;
            nearest = target;
          }
        }
      if ((nearest?.id || "") !== lastNear.current) {
        lastNear.current = nearest?.id || "";
        onNear(nearest);
      }
    }
  });
  return (
    <>
      <group ref={self}>
        <Avatar
          role={role}
          moving={net.local.moving}
          held={s.bags[role]?.[0]}
        />
      </group>
      <group ref={remote}>
        <Avatar
          role={(1 - role) as Role}
          moving={peerMoving}
          held={s.bags[1 - role]?.[0]}
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
      <group ref={hand}>
        <group position={[0.36, -0.42, -0.78]} rotation={[0.2, -0.3, 0]}>
          {s.hands[role] ? (
            <Lantern
              color={lanternColors[s.hands[role]!.color]}
              shape={s.hands[role]!.shape}
              scale={0.6}
            />
          ) : s.bags[role]?.length ? (
            <Produce kind={s.bags[role][0]} scale={0.65} />
          ) : (
            <Lantern scale={0.34} />
          )}
          <Pole p={[0, -0.2, 0.08]} r={0.065} h={0.3} color={colors[role]} />
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
}: {
  s: State;
  role: Role;
  onNear: (t: Target | null) => void;
  paused: boolean;
  quality: string;
}) {
  const targets = useMemo(() => targetsFor(s, role), [s, role]);
  const river = s.phase === 3 && s.boarded.length === 2,
    night = s.phase >= 6;
  const { scene, gl } = useThree();
  useEffect(() => {
    gl.toneMapping = T.ACESFilmicToneMapping;
    gl.toneMappingExposure = night ? 1.25 : 1.1;
    scene.background = new T.Color(
      night ? "#172d39" : s.phase >= 3 ? "#a99586" : "#bacac4",
    );
    scene.fog = new T.Fog(
      night ? "#263c44" : s.phase >= 3 ? "#a99586" : "#bacac4",
      night ? 50 : 85,
      night ? 175 : 220,
    );
  }, [s.phase, night, gl, scene]);
  return (
    <>
      <Atmosphere night={night} river={river} progress={s.boat.progress} />
      <hemisphereLight
        args={[
          night ? "#b6ccd6" : "#d9e4e2",
          night ? "#4d4740" : "#8c7757",
          night ? 0.85 : 1.3,
        ]}
      />
      <ambientLight intensity={night ? 0.35 : 0.3} />
      <directionalLight
        position={[35, 55, 25]}
        intensity={night ? 0.9 : 3.3}
        color={night ? "#8fa9cd" : "#ffe1ab"}
        castShadow={quality !== "low"}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={180}
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
      />
      {night && (
        <mesh
          position={river ? [40, 35, -s.boat.progress - 130] : [65, 49, -110]}
        >
          <sphereGeometry args={[7, 32, 24]} />
          <meshBasicMaterial color="#f1dcb6" fog={false} />
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
      {river ? (
        <River s={s} />
      ) : (
        <>
          <Ground />
          <Water />
          <Forest />
          <Village s={s} />
          <FloatingLeaves />
          {s.phase <= 2 &&
            props
              .filter((p) => p.phase === s.phase && !s.collected.includes(p.id))
              .map((p) => (
                <Produce key={p.id} kind={p.kind} position={[p.x, 0.04, p.z]} />
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
          {s.phase >= 4 && s.phase !== 6 && s.phase !== 5 && <Kitchen s={s} />}
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
          {s.phase === 8 && <NightLanterns />}
        </>
      )}
      <Player
        s={s}
        role={role}
        targets={targets}
        onNear={onNear}
        paused={paused}
      />
      {quality === "high" && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.45} luminanceThreshold={1.1} mipmapBlur />
          <Vignette eskil={false} offset={0.22} darkness={0.32} />
        </EffectComposer>
      )}
    </>
  );
}
export default function World(props: {
  s: State;
  role: Role;
  onNear: (t: Target | null) => void;
  paused: boolean;
  quality: string;
}) {
  return (
    <Canvas
      shadows={props.quality !== "low" ? "percentage" : false}
      dpr={props.quality === "low" ? 1 : [1, 1.5]}
      camera={{ fov: 70, near: 0.08, far: 350 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        if (import.meta.env.DEV)
          Object.assign((window as any).__autumn, { renderInfo: gl.info });
        gl.domElement.setAttribute(
          "aria-label",
          "First-person Bramblewick game world",
        );
      }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}
