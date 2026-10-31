import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import type { State } from "../../server/autumn/rules";
import { rand, towers, lanternStands, props } from "./content";
import { Box, Pole, Sign } from "./Models";

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}

const waterShader = {
  name: "BramblewickWater",
  uniforms: {
    ...T.UniformsLib.fog,
    color: { value: new T.Color("#456d69") },
    tDiffuse: { value: null },
    textureMatrix: { value: new T.Matrix4() },
    time: { value: 0 },
    night: { value: 0 },
    river: { value: 0 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 reflectionUv; varying vec3 worldPosition; varying vec2 localPosition;
    #include <common>
    #include <fog_pars_vertex>
    void main(){
      reflectionUv=textureMatrix*vec4(position,1.);
      worldPosition=(modelMatrix*vec4(position,1.)).xyz;
      localPosition=position.xy;
      vec4 mvPosition=modelViewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 color; uniform float time; uniform float night; uniform float river;
    varying vec4 reflectionUv; varying vec3 worldPosition; varying vec2 localPosition;
    #include <common>
    #include <fog_pars_fragment>
    float wave(vec2 p){return sin(p.x*.81+time*.54+sin(p.y*.34-time*.28))*.55+sin(p.y*1.24-time*.68+sin(p.x*.28))*.3+sin(dot(p,vec2(2.1,.8))+time*1.1)*.15;}
    void main(){
      vec2 p=worldPosition.xz;
      float a=wave(p), b=wave(p+vec2(.12,0.)), c=wave(p+vec2(0.,.12));
      vec3 normal=normalize(vec3((a-b)*.6,1.,(a-c)*.6));
      vec3 view=normalize(cameraPosition-worldPosition);
      float fresnel=.12+.78*pow(1.-max(0.,dot(view,normal)),3.);
      vec4 uv=reflectionUv; uv.xy+=normal.xz*.018*uv.w;
      vec3 reflected=texture2DProj(tDiffuse,uv).rgb;
      vec3 deep=mix(vec3(.018,.12,.13),vec3(.012,.045,.065),night);
      vec3 body=mix(deep,vec3(.12,.29,.25),(.5+.5*a)*.19);
      vec3 col=mix(body,reflected,clamp(fresnel,.18,.86));
      vec3 sun=normalize(vec3(.5,.8,.4));
      float spec=pow(max(dot(reflect(-sun,normal),view),0.),180.);
      col+=mix(vec3(1.5,1.05,.45),vec3(.32,.46,.6),night)*spec*.7;
      float edge=mix(10.-abs(localPosition.y),17.-abs(localPosition.x),river);
      float foam=(1.-smoothstep(.05,.75,edge))*(.45+.55*sin(edge*14.-time*1.8+a*2.));
      col=mix(col,vec3(.55,.67,.53),clamp(foam,0.,.42));
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

/** One real mirrored scene pass. Resolution and cadence are bounded independently of screen DPI. */
export function ReflectiveWater({
  river = false,
  quality = "high",
  night = false,
}: {
  river?: boolean;
  quality?: string;
  night?: boolean;
}) {
  const reflector = useMemo(() => {
    const geometry = new T.PlaneGeometry(river ? 34 : 320, river ? 1800 : 20);
    const resolution =
      quality === "low" ? 256 : quality === "medium" ? 512 : 1024;
    const water = new Reflector(geometry, {
      textureWidth: resolution,
      textureHeight: resolution,
      clipBias: 0.003,
      multisample: 0,
      shader: waterShader,
    });
    (water.material as T.ShaderMaterial).fog = true;
    (water.material as T.ShaderMaterial).uniforms.river.value = river ? 1 : 0;
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.065, river ? -350 : -68);
    const render = water.onBeforeRender;
    let lastRender = -Infinity;
    water.onBeforeRender = function (
      renderer,
      scene,
      camera,
      geometry,
      material,
      group,
    ) {
      // Reflection cameras do not recursively capture another reflective surface.
      if (camera.userData.autumnReflection) return;
      const now = performance.now();
      if (now - lastRender < (quality === "low" ? 100 : 40)) return;
      if (!river && Math.abs(camera.position.z + 68) > 115) return;
      lastRender = now;
      const local = scene.getObjectByName("local-avatar"),
        hands = scene.getObjectByName("first-person-hands");
      const wasLocal = local?.visible,
        wasHands = hands?.visible;
      if (local) local.visible = true;
      if (hands) hands.visible = false;
      const reflectionCamera = water.getReflectionCamera(camera);
      reflectionCamera.userData.autumnReflection = true;
      try {
        render.call(water, renderer, scene, camera, geometry, material, group);
      } finally {
        if (local) local.visible = !!wasLocal;
        if (hands) hands.visible = !!wasHands;
      }
    };
    return water;
  }, [river, quality]);
  useEffect(
    () => () => {
      reflector.geometry.dispose();
      reflector.dispose();
    },
    [reflector],
  );
  useFrame(({ clock }, dt) => {
    const uniforms = (reflector.material as T.ShaderMaterial).uniforms;
    uniforms.time.value = clock.elapsedTime;
    uniforms.night.value = T.MathUtils.damp(
      uniforms.night.value,
      night ? 1 : 0,
      1.4,
      dt,
    );
  });
  return <primitive object={reflector} dispose={null} />;
}

function PathStones() {
  const geometry = useMemo(() => new T.IcosahedronGeometry(1, 1), []);
  const meshes = useRef<T.InstancedMesh>(null);
  useEffect(() => {
    const m = meshes.current;
    if (!m) return;
    const o = new T.Object3D(),
      c = new T.Color();
    for (let i = 0; i < 1100; i++) {
      const z = -55 + rand(i + 1800) * 98;
      const x = (rand(i + 3000) - 0.5) * 6.3;
      o.position.set(x, 0.022, z);
      o.scale.set(
        0.06 + rand(i) * 0.1,
        0.018 + rand(i + 4) * 0.025,
        0.07 + rand(i + 5) * 0.1,
      );
      o.rotation.set(0, rand(i + 200) * 6.28, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(
        i,
        c.set(["#a39270", "#c2b394", "#847b62", "#d0c4a7"][i % 4]),
      );
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <instancedMesh
      ref={meshes}
      args={[geometry, undefined, 1100]}
      receiveShadow
    >
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}
function Riverbank({
  river = false,
  progress = 0,
}: {
  river?: boolean;
  progress?: number;
}) {
  const reeds = useRef<T.InstancedMesh>(null),
    stones = useRef<T.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ time: { value: 0 } }), []);
  const chunk = river ? Math.floor(progress / 80) : 0;
  useEffect(() => {
    const o = new T.Object3D(),
      c = new T.Color();
    if (!reeds.current || !stones.current) return;
    for (let i = 0; i < 420; i++) {
      const side = i % 2 ? 1 : -1;
      const x = river
        ? side * (16.8 + rand(i + 1) * 1.7)
        : (rand(i + 6) - 0.5) * 145;
      const z = river
        ? -chunk * 80 - 130 + rand(i + 5) * 210
        : -68 + side * (9.7 + rand(i + 3) * 1.1);
      o.position.set(x, 0.1, z);
      o.scale.set(0.07, 0.5 + rand(i) * 0.8, 0.06);
      o.rotation.set(0, rand(i + 1) * 6.28, side * 0.1);
      o.updateMatrix();
      reeds.current.setMatrixAt(i, o.matrix);
      reeds.current.setColorAt(i, c.set(i % 3 ? "#897b45" : "#c6ad6b"));
      if (i < 160) {
        o.position.set(x, 0, z);
        o.scale.set(
          0.2 + rand(i + 1) * 0.5,
          0.18 + rand(i + 2) * 0.4,
          0.2 + rand(i + 5) * 0.5,
        );
        o.rotation.set(rand(i), rand(i + 5) * 6.28, 0);
        o.updateMatrix();
        stones.current.setMatrixAt(i, o.matrix);
        stones.current.setColorAt(i, c.set(i % 2 ? "#8d8b75" : "#6a766d"));
      }
    }
    reeds.current.instanceMatrix.needsUpdate = true;
    stones.current.instanceMatrix.needsUpdate = true;
    reeds.current.computeBoundingSphere();
    stones.current.computeBoundingSphere();
  }, [river, chunk]);
  useFrame(({ clock }) => (uniforms.time.value = clock.elapsedTime));
  return (
    <>
      <instancedMesh ref={reeds} args={[undefined, undefined, 420]}>
        <coneGeometry args={[1, 1, 3, 3]} />
        <meshStandardMaterial
          roughness={1}
          onBeforeCompile={(shader) => {
            shader.uniforms.time = uniforms.time;
            shader.vertexShader = "uniform float time;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>\nfloat phase=instanceMatrix[3].x*.3+instanceMatrix[3].z*.18;transformed.x+=pow(position.y+.5,2.)*(sin(time*1.3+phase)*.6+sin(time*.57+phase)*.3);`,
            );
          }}
        />
      </instancedMesh>
      <instancedMesh
        ref={stones}
        args={[undefined, undefined, 160]}
        receiveShadow
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
    </>
  );
}
function ChimneySmoke() {
  const smokeSources = useMemo(
    () =>
      houses.map((h) => [
        h.p[0] + (1.8 * Math.cos(h.r) - 0.8 * Math.sin(h.r)) * h.s,
        5.7 * h.s,
        h.p[2] + (-1.8 * Math.sin(h.r) - 0.8 * Math.cos(h.r)) * h.s,
      ]),
    [],
  );
  const mesh = useRef<T.InstancedMesh>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradient.addColorStop(0, "#ffffff44");
    gradient.addColorStop(0.5, "#ffffff1c");
    gradient.addColorStop(1, "#ffffff00");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(canvas);
  }, []);
  const object = useMemo(() => new T.Object3D(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ clock, camera }) => {
    if (!mesh.current) return;
    smokeSources.forEach((source, j) => {
      for (let k = 0; k < 7; k++) {
        const i = j * 7 + k,
          age = (clock.elapsedTime * 0.17 + k / 7) % 1;
        object.position.set(
          source[0] + Math.sin(age * 2 + j) * age * 2,
          source[1] + age * 8,
          source[2] + age * 3,
        );
        object.quaternion.copy(camera.quaternion);
        object.scale.setScalar((0.45 + age * 2.2) * Math.sin(age * Math.PI));
        object.updateMatrix();
        mesh.current!.setMatrixAt(i, object.matrix);
      }
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 42]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        color="#e8dbbc"
        transparent
        depthWrite={false}
      />
    </instancedMesh>
  );
}
function Bunting() {
  const material = useRef<T.MeshStandardMaterial>(null);
  const uniforms = useMemo(() => ({ time: { value: 0 } }), []);
  useFrame(({ clock }) => (uniforms.time.value = clock.elapsedTime));
  const rope = useMemo(
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          Array.from(
            { length: 25 },
            (_, i) =>
              new T.Vector3(
                -14.5 + (i * 29) / 24,
                -Math.sin((i / 24) * Math.PI) * 0.75,
                0,
              ),
          ),
        ),
        48,
        0.014,
        4,
        false,
      ),
    [],
  );
  useEffect(() => () => rope.dispose(), [rope]);
  const data = useMemo(() => {
    const geometry = new T.PlaneGeometry(0.55, 0.7, 5, 6);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setX(i, (pos.getX(i) * (y + 0.35)) / 0.7);
      pos.setY(i, y - 0.35);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => data.dispose(), [data]);
  return (
    <group position={[0, 4.4, 29]}>
      <mesh geometry={rope}>
        <meshStandardMaterial color="#82734e" roughness={1} />
      </mesh>
      {Array.from({ length: 23 }, (_, i) => (
        <mesh
          key={i}
          position={[
            -13.2 + i * 1.2,
            -Math.sin(((1.3 + i * 1.2) / 29) * Math.PI) * 0.75,
            0,
          ]}
          geometry={data}
        >
          <meshStandardMaterial
            ref={material}
            color={["#d4a854", "#af654c", "#729e8b", "#c6b27b"][i % 4]}
            side={T.DoubleSide}
            roughness={1}
            onBeforeCompile={(shader) => {
              shader.uniforms.time = uniforms.time;
              shader.vertexShader =
                "uniform float time;\n" + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>\ntransformed.z+=sin(position.y*5.+time*2.1+modelMatrix[3].x*.4)*abs(position.y)*.3;`,
              );
            }}
          />
        </mesh>
      ))}
      {[-14.5, 14.5].map((x) => (
        <Pole key={x} p={[x, -2.2, 0]} h={4.4} r={0.06} />
      ))}
    </group>
  );
}
function VillageFurniture() {
  return (
    <>
      <group position={[-8, 0, 39]} rotation={[0, 0.3, 0]}>
        {[-0.32, 0, 0.32].map((z) => (
          <Box key={z} p={[0, 0.53, z]} s={[2.8, 0.09, 0.24]} color="#8a6544" />
        ))}
        {[0.9, 1.2].map((y) => (
          <Box key={y} p={[0, y, -0.4]} s={[2.8, 0.18, 0.08]} color="#8a6544" />
        ))}
        {[-1.1, 1.1].map((x) => (
          <group key={x}>
            <Box p={[x, 0.27, 0]} s={[0.09, 0.54, 0.75]} color="#354340" />
            <Box p={[x, 0.8, -0.4]} s={[0.08, 0.8, 0.08]} color="#354340" />
          </group>
        ))}
        <Box p={[0.7, 0.64, 0.05]} s={[0.45, 0.08, 0.32]} color="#45675c" />
        <Box p={[0.72, 0.7, 0.05]} s={[0.38, 0.045, 0.27]} color="#cab98d" />
      </group>
      <group position={[9, 0, 36]} rotation={[0, -0.2, 0]}>
        <Pole p={[0, 0.15, 0]} h={0.3} r={0.4} color="#6c7465" />
        <Pole p={[0, 1.8, 0]} h={3.6} r={0.09} />
        <Sign text="THE ORCHARD  ←" p={[0, 2.65, 0.1]} width={2.4} />
        <Sign text="THE OLD MILL  →" p={[0, 2, 0.1]} width={2.4} />
        <Sign text="TAKE THE LONG WAY" p={[0, 1.35, 0.1]} width={2.4} />
      </group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 10, 0, 24]}>
          <mesh position={[0, 0.38, 0]} castShadow>
            <cylinderGeometry args={[0.46, 0.38, 0.76, 14]} />
            <meshStandardMaterial color="#956946" roughness={0.9} />
          </mesh>
          {[0.12, 0.63].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.455, 0.455, 0.065, 14]} />
              <meshStandardMaterial
                color="#4b5146"
                metalness={0.45}
                roughness={0.6}
              />
            </mesh>
          ))}
          <mesh position={[0, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.43, 14]} />
            <meshStandardMaterial color="#62452e" />
          </mesh>
          <Pole p={[0, 1.35, 0]} r={0.035} h={1.1} color="#6e7d4e" />
          {Array.from({ length: 5 }, (_, i) => (
            <mesh
              key={i}
              position={[
                Math.sin(i * 2.4) * 0.25,
                1.5 + rand(i) * 0.35,
                Math.cos(i * 2.4) * 0.25,
              ]}
            >
              <sphereGeometry args={[0.1, 8, 6]} />
              <meshStandardMaterial color={side < 0 ? "#deb45f" : "#b77b61"} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
function Firelight({ night }: { night: boolean }) {
  const ref = useRef<T.ShaderMaterial>(null),
    light = useRef<T.PointLight>(null);
  const uniforms = useMemo(() => ({ time: { value: 0 } }), []);
  useFrame(({ clock }) => {
    uniforms.time.value = clock.elapsedTime;
    if (light.current)
      light.current.intensity =
        (night ? 5 : 2.5) +
        Math.sin(clock.elapsedTime * 8) * 0.25 +
        Math.sin(clock.elapsedTime * 13) * 0.15;
  });
  return (
    <group position={[0, 0.12, 13]}>
      {[0, Math.PI / 2].map((rotation) => (
        <mesh
          key={rotation}
          position={[0, 0.65, 0]}
          rotation={[0, rotation, 0]}
        >
          <planeGeometry args={[1.15, 1.65]} />
          <shaderMaterial
            ref={ref}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            side={T.DoubleSide}
            blending={T.AdditiveBlending}
            vertexShader={`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
            fragmentShader={`varying vec2 v;uniform float time;float h(vec2 p){return fract(sin(dot(p,vec2(27.1,61.7)))*43758.54);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}void main(){vec2 p=v;float noise=n(vec2(p.x*7.,p.y*6.-time*3.));float shape=(1.-p.y)*.4;float x=abs(p.x-.5+sin(p.y*7.-time*3.)*p.y*.09);float a=smoothstep(shape,shape-.12,x)*(1.-smoothstep(.45,1.,p.y+noise*.22));vec3 c=mix(vec3(1.,.14,.015),vec3(1.,.78,.22),1.-p.y);gl_FragColor=vec4(c,a*.85);}`}
          />
        </mesh>
      ))}
      <pointLight
        ref={light}
        position={[0, 1, 0]}
        color="#ffae58"
        intensity={3}
        distance={12}
        decay={2}
      />
    </group>
  );
}

/** Success feedback is based on durable state changes; reload never replays a completed effect. */
function ProgressMagic({ s }: { s: State }) {
  const reduced = useReducedMotion();
  const mesh = useRef<T.InstancedMesh>(null);
  const previous = useRef(s);
  const bursts = useRef<{ x: number; z: number; at: number; color: string }[]>(
    [],
  );
  const o = useMemo(() => new T.Object3D(), []),
    c = useMemo(() => new T.Color(), []);
  useEffect(() => {
    const old = previous.current;
    previous.current = s;
    const add = (x: number, z: number, color = "#ffcc76") => {
      if (!reduced) bursts.current.push({ x, z, at: performance.now(), color });
    };
    if (s.phase !== old.phase) add(0, 13, "#f5d69a");
    if (s.bridge > old.bridge) add(0, -58 - s.bridge * 2.5);
    if (s.order > old.order) add(0, 20, "#b4e4b0");
    for (const id of s.collected)
      if (!old.collected.includes(id)) {
        const prop = props.find((p) => p.id === id);
        if (prop)
          add(prop.x, prop.z, prop.kind === "wood" ? "#d6b17d" : "#e8b757");
      }
    if (s.dish?.cooked && !old.dish?.cooked) add(5, 20, "#f9dda0");
    for (const i of s.towers)
      if (!old.towers.includes(i)) add(towers[i].x, towers[i].z, "#a5e6e1");
    for (const l of lanternStands)
      if (s.lanterns[l.id] && !old.lanterns[l.id]) add(l.x, l.z, "#edbf8c");
    for (const r of s.ready) if (!old.ready.includes(r)) add(r ? 3 : -3, 32);
    bursts.current = bursts.current.slice(-4);
  }, [s]);
  useFrame(() => {
    if (!mesh.current) return;
    const now = performance.now();
    bursts.current = bursts.current.filter((b) => now - b.at < 4200);
    for (let i = 0; i < 240; i++) {
      const burst = bursts.current[Math.floor(i / 60)];
      if (!burst) {
        o.scale.setScalar(0);
        o.updateMatrix();
        mesh.current.setMatrixAt(i, o.matrix);
        continue;
      }
      const t = (now - burst.at) / 1000,
        seed = i % 60,
        a = seed * 2.399 + t * 0.4,
        r = Math.sqrt(seed / 60) * (1 + t * 2.5);
      o.position.set(
        burst.x + Math.cos(a) * r,
        0.25 + t * (1 + rand(seed) * 1.1) - t * t * 0.12,
        burst.z + Math.sin(a) * r,
      );
      o.scale.setScalar(
        0.025 + Math.sin(Math.min(1, t / 4.2) * Math.PI) * 0.065,
      );
      o.rotation.set(t + seed, t * 2, seed);
      o.updateMatrix();
      mesh.current.setMatrixAt(i, o.matrix);
      mesh.current.setColorAt(i, c.set(burst.color));
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 240]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
function SkyRibbon({ phase }: { phase: number }) {
  const material = useRef<T.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ time: { value: 0 }, strength: { value: 0 } }),
    [],
  );
  useFrame(({ clock }, dt) => {
    uniforms.time.value = clock.elapsedTime;
    uniforms.strength.value = T.MathUtils.damp(
      uniforms.strength.value,
      phase >= 8 ? 0.7 : phase >= 6 ? 0.18 : 0,
      0.32,
      dt,
    );
  });
  return (
    <mesh position={[0, 30, -100]} rotation={[0.12, 0, 0]}>
      <planeGeometry args={[220, 70, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={T.AdditiveBlending}
        side={T.DoubleSide}
        vertexShader={`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec2 v;uniform float time;uniform float strength;void main(){float curve=.43+sin(v.x*7.+time*.045)*.15+sin(v.x*19.-time*.07)*.035;float d=v.y-curve;float ribbon=exp(-abs(d)*18.)*smoothstep(-.03,.08,d);float rays=.65+.35*sin(v.x*210.+sin(v.x*27.+time*.1)*3.);float edge=sin(v.x*3.14159);vec3 c=mix(vec3(.15,.65,.47),vec3(.48,.3,.62),v.y);gl_FragColor=vec4(c,ribbon*rays*edge*strength);}`}
      />
    </mesh>
  );
}

const houses = [
  { p: [0, 0, 49], r: Math.PI, s: 1.6 },
  { p: [-22, 0, 36], r: 0.55, s: 1 },
  { p: [23, 0, 37], r: -0.65, s: 1 },
  { p: [36, 0, 17], r: -1.3, s: 1 },
  { p: [-39, 0, 24], r: 1.1, s: 1 },
  { p: [38, 0, -29], r: -0.55, s: 1.5 },
];
function Architecture() {
  const tiles = useRef<T.InstancedMesh>(null),
    details = useRef<T.InstancedMesh>(null);
  useEffect(() => {
    if (!tiles.current || !details.current) return;
    const house = new T.Object3D(),
      roof = new T.Object3D(),
      o = new T.Object3D(),
      matrix = new T.Matrix4(),
      c = new T.Color();
    let ti = 0,
      di = 0;
    const part = (p: number[], scale: number[], color: string) => {
      o.position.set(p[0], p[1], p[2]);
      o.scale.set(scale[0], scale[1], scale[2]);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      matrix.multiplyMatrices(house.matrix, o.matrix);
      details.current!.setMatrixAt(di, matrix);
      details.current!.setColorAt(di++, c.set(color));
    };
    for (const h of houses) {
      house.position.set(h.p[0], h.p[1], h.p[2]);
      house.rotation.set(0, h.r, 0);
      house.scale.setScalar(h.s);
      house.updateMatrix();
      for (const side of [-1, 1]) {
        roof.position.set(side * 1.65, 3.8, 0);
        roof.rotation.set(0, 0, side * -0.52);
        roof.updateMatrix();
        for (let row = 0; row < 8; row++)
          for (let col = 0; col < 10; col++) {
            o.position.set(
              -1.74 + row * 0.49,
              0.13 + rand(row + col) * 0.012,
              -2.63 + col * 0.585,
            );
            o.scale.set(0.5, 0.028, 0.575);
            o.rotation.set(0, 0, 0);
            o.updateMatrix();
            matrix
              .multiplyMatrices(house.matrix, roof.matrix)
              .multiply(o.matrix);
            tiles.current.setMatrixAt(ti, matrix);
            tiles.current.setColorAt(
              ti++,
              c.set(
                ["#45595a", "#536260", "#526560", "#596966", "#66736d"][
                  Math.floor(rand(ti) * 5)
                ],
              ),
            );
          }
      }
      for (const x of [-1.8, 1.8]) {
        for (const side of [-1, 1]) {
          // Louvred shutters, weathered sill and curtain edges.
          part([x + side * 0.79, 1.85, 2.53], [0.3, 1.35, 0.11], "#536d5e");
          for (let i = 0; i < 7; i++)
            part(
              [x + side * 0.79, 1.3 + i * 0.17, 2.6],
              [0.32, 0.035, 0.035],
              "#83917b",
            );
          part([x + side * 0.37, 1.85, 2.665], [0.15, 1.13, 0.025], "#d9c99f");
        }
        part([x, 2.37, 2.67], [1, 0.14, 0.025], "#e0cfaa");
        part([x, 1.1, 2.93], [1.55, 0.2, 0.035], "#8e6447");
        for (let i = 0; i < 5; i++)
          part([x - 0.6 + i * 0.3, 1.1, 2.96], [0.025, 0.2, 0.025], "#b48c60");
      }
      for (let i = 0; i < 9; i++)
        part(
          [-2.8 + i * 0.7, 0.15, 2.59],
          [0.62, 0.2, 0.09],
          i % 2 ? "#9a9480" : "#b3aa94",
        );
      // Door brass kick plate and trim remain clear of the gameplay lane.
      part([0, 0.2, 2.57], [1.05, 0.18, 0.03], "#aa8f58");
      part([-0.66, 1.1, 2.57], [0.08, 2.2, 0.08], "#846245");
      part([0.66, 1.1, 2.57], [0.08, 2.2, 0.08], "#846245");
      part([0, 2.21, 2.57], [1.4, 0.13, 0.1], "#846245");
    }
    tiles.current.count = ti;
    details.current.count = di;
    tiles.current.instanceMatrix.needsUpdate = true;
    details.current.instanceMatrix.needsUpdate = true;
    tiles.current.computeBoundingSphere();
    details.current.computeBoundingSphere();
  }, []);
  return (
    <>
      <instancedMesh
        ref={tiles}
        args={[undefined, undefined, 960]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.87} />
      </instancedMesh>
      <instancedMesh
        ref={details}
        args={[undefined, undefined, 480]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.82} />
      </instancedMesh>
    </>
  );
}
function StationClock() {
  const hour = useRef<T.Group>(null),
    minute = useRef<T.Group>(null),
    second = useRef<T.Group>(null);
  useFrame(() => {
    const now = new Date();
    if (hour.current)
      hour.current.rotation.z =
        (-((now.getHours() % 12) + now.getMinutes() / 60) * Math.PI) / 6;
    if (minute.current)
      minute.current.rotation.z =
        (-(now.getMinutes() + now.getSeconds() / 60) * Math.PI) / 30;
    if (second.current)
      second.current.rotation.z =
        (-(now.getSeconds() + now.getMilliseconds() / 1000) * Math.PI) / 30;
  });
  return (
    <group position={[0, 4.8, 42.48]} rotation={[0, Math.PI, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.12, 40]} />
        <meshStandardMaterial
          color="#b39558"
          metalness={0.65}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <circleGeometry args={[0.53, 40]} />
        <meshStandardMaterial color="#e7d7ad" roughness={0.8} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} rotation={[0, 0, (-i * Math.PI) / 6]}>
          <Box p={[0, 0.46, 0.085]} s={[0.025, 0.075, 0.012]} color="#35483e" />
        </group>
      ))}
      <group ref={hour}>
        <Box p={[0, 0.15, 0.1]} s={[0.035, 0.3, 0.018]} color="#344c44" />
      </group>
      <group ref={minute}>
        <Box p={[0, 0.2, 0.12]} s={[0.025, 0.4, 0.018]} color="#344c44" />
      </group>
      <group ref={second}>
        <Box p={[0, 0.17, 0.14]} s={[0.012, 0.42, 0.012]} color="#a96844" />
      </group>
      <mesh position={[0, 0, 0.16]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#a68043" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function WorldDetails({
  s,
  river = false,
}: {
  s: State;
  river?: boolean;
}) {
  return (
    <>
      <Riverbank river={river} progress={s.boat.progress} />
      {!river && (
        <>
          <PathStones />
          <Architecture />
          <StationClock />
          <ChimneySmoke />
          <Bunting />
          <VillageFurniture />
          <Firelight night={s.phase >= 6} />
          <ProgressMagic s={s} />
          <SkyRibbon phase={s.phase} />
        </>
      )}
    </>
  );
}

/** Durable construction stays assembled on rejoin; only new sections play the hand-built settle. */
export function BuiltBridge({ s }: { s: State }) {
  const reduced = useReducedMotion();
  const sections = useRef<(T.Group | null)[]>([]),
    planks = useRef<(T.Group | null)[]>([]);
  const previous = useRef(s.bridge),
    started = useRef<Record<number, number>>({});
  useEffect(() => {
    if (!reduced)
      for (let i = previous.current; i < s.bridge; i++)
        started.current[i] = performance.now();
    previous.current = s.bridge;
  }, [s.bridge]);
  useFrame(() => {
    const now = performance.now();
    sections.current.forEach((g, i) => {
      if (!g) return;
      const age =
        reduced || started.current[i] === undefined
          ? 10
          : (now - started.current[i]) / 1000;
      const t = T.MathUtils.clamp((age - 0.35) / 0.8, 0, 1),
        ease = 1 - Math.pow(1 - t, 3);
      g.position.y = (1 - ease) * -0.9;
      g.scale.y = Math.max(0.001, ease);
    });
    planks.current.forEach((g, index) => {
      if (!g) return;
      const section = Math.floor(index / 5),
        j = index % 5;
      const age =
        reduced || started.current[section] === undefined
          ? 10
          : (now - started.current[section]) / 1000;
      const t = T.MathUtils.clamp((age - j * 0.085) / 0.65, 0, 1),
        ease = 1 - Math.pow(1 - t, 3);
      g.position.y = (1 - ease) * 1.6;
      g.rotation.x = (1 - ease) * 0.16 * (j % 2 ? 1 : -1);
    });
  });
  return (
    <group position={[0, 0, -58]}>
      <Box p={[0, 0.18, 0]} s={[7, 0.36, 4]} color="#8c7250" />
      {Array.from({ length: s.bridge }, (_, i) => (
        <group key={i} position={[0, 0, -3 - i * 2.5]}>
          {Array.from({ length: 5 }, (_, j) => (
            <group
              key={j}
              ref={(g) => {
                planks.current[i * 5 + j] = g;
              }}
            >
              <Box
                p={[0, 0.18, -1 + j * 0.5]}
                s={[4, 0.3, 0.475]}
                color={
                  ["#ad8755", "#a78354", "#b4915f", "#b39163", "#ac8959"][j]
                }
              />
              {[-1.7, 1.7].map((x) => (
                <mesh
                  key={x}
                  position={[x, 0.338, -1 + j * 0.5]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <circleGeometry args={[0.025, 6]} />
                  <meshStandardMaterial
                    color="#4b5146"
                    metalness={0.6}
                    roughness={0.55}
                  />
                </mesh>
              ))}
            </group>
          ))}
          <group
            ref={(g) => {
              sections.current[i] = g;
            }}
          >
            {[-2, 2].map((x) => (
              <group key={x}>
                <Pole p={[x, 0.8, 0]} r={0.09} h={1.6} />
                <Box p={[x, 1.4, 0]} s={[0.15, 0.13, 2.5]} color="#8d673f" />
                <Box p={[x, 0.7, 0]} s={[0.09, 0.08, 2.5]} color="#97764c" />
                <Box p={[x, 1.65, 0]} s={[0.23, 0.08, 0.23]} color="#775837" />
                <Box p={[x, 0.32, 0]} s={[0.21, 0.07, 0.21]} color="#48534c" />
                <Box
                  p={[x * 0.75, -0.12, 0]}
                  s={[0.2, 0.32, 2.5]}
                  color="#775735"
                />
              </group>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
