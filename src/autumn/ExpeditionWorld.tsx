import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Box, Lantern, Pole, Sign } from "./Models";
import { StaticGeometry } from "./StaticGeometry";
import { pbrTextures } from "./materials";
import { net } from "./network";
import { input } from "./controls";
import { rand } from "./content";
import ExpeditionLandscape from "./ExpeditionLandscape";
import { LocalLightSource } from "./LocalLighting";
import {
  expeditionControls,
  waterReceivers,
  lightReceivers,
  lightReceiver,
  waterTarget,
  focusTarget,
  carryWaypoints,
  heartStart,
  conservatory,
  assemblyPads,
  assemblyFocus,
  returnPoint,
  lookout,
  expeditionPathsComplete,
  receiverAlignment,
} from "./expeditionContent";
import type { Expedition } from "./expeditionContent";

type Triple = [number, number, number];
const BRASS = "#ad9663",
  IRON = "#354c48",
  STONE = "#a0a48d";
let copper: T.MeshStandardMaterial | undefined;
function copperMaterial() {
  if (!copper) {
    copper = new T.MeshStandardMaterial({
      color: "#a79367",
      metalness: 0.7,
      roughness: 0.38,
      ...pbrTextures("stone"),
      normalScale: new T.Vector2(0.08, 0.08),
    });
    copper.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec3 copperPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ncopperPosition=position;",
      );
      shader.fragmentShader =
        "varying vec3 copperPosition;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        float patina=.5+.5*sin(copperPosition.x*17.+sin(copperPosition.z*23.))*sin(copperPosition.y*21.+copperPosition.z*7.);
        diffuseColor.rgb*=mix(vec3(1.),vec3(.34,.59,.48),smoothstep(.67,.94,patina)*.58);
      `,
      );
    };
    copper.customProgramCacheKey = () => "bellweather-weathered-copper-v1";
  }
  return copper;
}
let glass: T.MeshPhysicalMaterial | undefined;
function glassMaterial() {
  if (!glass) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#575757";
    x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 150; i++) {
      const px = rand(i + 110) * 128,
        py = rand(i + 220) * 128;
      x.fillStyle = i % 3 ? "#959595" : "#333333";
      x.beginPath();
      x.ellipse(
        px,
        py,
        0.25 + rand(i) * 0.6,
        1 + rand(i + 7) * 4,
        0.03,
        0,
        Math.PI * 2,
      );
      x.fill();
    }
    const rough = new T.CanvasTexture(c);
    rough.wrapS = rough.wrapT = T.RepeatWrapping;
    glass = new T.MeshPhysicalMaterial({
      color: "#b8d7d1",
      metalness: 0.17,
      roughness: 0.32,
      roughnessMap: rough,
      clearcoat: 1,
      clearcoatRoughness: 0.11,
      transparent: true,
      opacity: 0.23,
      side: T.DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.8,
    });
  }
  return glass;
}
function Pipe({
  points,
  radius = 0.09,
}: {
  points: Triple[];
  radius?: number;
}) {
  const geometry = useMemo(
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(
          points.map((p) => new T.Vector3(...p)),
          false,
          "centripetal",
        ),
        Math.max(8, points.length * 5),
        radius,
        8,
        false,
      ),
    [points, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      material={copperMaterial()}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
function Ring({
  position = [0, 0, 0],
  radius = 0.5,
  thickness = 0.04,
  rotation = [0, 0, 0],
}: {
  position?: Triple;
  radius?: number;
  thickness?: number;
  rotation?: Triple;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      material={copperMaterial()}
      castShadow
      dispose={null}
    >
      <torusGeometry args={[radius, thickness, 8, 32]} />
    </mesh>
  );
}

const FixedArchitecture = memo(function FixedArchitecture() {
  const cx = conservatory.x,
    cz = conservatory.z;
  const pipes = useMemo<Triple[][]>(
    () => [
      [
        [-34, 0.42, 15],
        [-46, 0.3, 18],
        [-62, 0.28, 15],
      ],
      [
        [-62, 0.28, 15],
        [-65, 0.3, 3],
        [-62, 0.28, -10],
      ],
      [
        [-62, 0.28, -10],
        [-53, 0.24, -22],
        [-42, 0.35, -27],
      ],
      [
        [-42, 0.35, -27],
        [-30, 0.2, -32],
        [-16, 0.3, -46],
        [-11.8, 0.8, -46],
      ],
    ],
    [],
  );
  return (
    <group name="conservatory-architecture">
      <StaticGeometry>
        {/* Foundation courses end at both generous doorways; no coplanar face overlays. */}
        {[-1, 1].map((side) => (
          <group key={side}>
            {Array.from({ length: 22 }, (_, i) => (
              <Box
                key={i}
                p={[cx + side * 12, 0.19, cz - 12.6 + i * 1.2]}
                s={[0.48, 0.38, 1.16]}
                color={STONE}
                material="stone"
              />
            ))}
            {[-13, 13].map((z) => (
              <group key={z}>
                {Array.from({ length: 7 }, (_, i) => (
                  <Box
                    key={i}
                    p={[cx + side * (3.65 + i * 1.2), 0.19, cz + z]}
                    s={[1.16, 0.38, 0.48]}
                    color={STONE}
                    material="stone"
                  />
                ))}
              </group>
            ))}
            {[-12.7, -8.5, -4.25, 0, 4.25, 8.5, 12.7].map((z) => (
              <group key={z}>
                <Box
                  p={[cx + side * 12, 2.3, cz + z]}
                  s={[0.15, 4.4, 0.15]}
                  color={IRON}
                  material="metal"
                />
                <Box
                  p={[cx + side * 12, 0.62, cz + z]}
                  s={[0.23, 0.15, 0.23]}
                  color={BRASS}
                  material="metal"
                />
              </group>
            ))}
            {[1.7, 3.1, 4.35].map((y) => (
              <Box
                key={y}
                p={[cx + side * 12, y, cz]}
                s={[0.11, 0.11, 26]}
                color={IRON}
                material="metal"
              />
            ))}
            {[-13, 13].map((z) => (
              <group key={z}>
                {[3, 6, 9, 12].map((x) => (
                  <Box
                    key={x}
                    p={[cx + side * x, 2.3, cz + z]}
                    s={[0.15, 4.4, 0.15]}
                    color={IRON}
                    material="metal"
                  />
                ))}
                {[1.7, 3.1, 4.35].map((y) => (
                  <Box
                    key={y}
                    p={[cx + side * 7.5, y, cz + z]}
                    s={[9, 0.11, 0.11]}
                    color={IRON}
                    material="metal"
                  />
                ))}
              </group>
            ))}
          </group>
        ))}
        {/* A real stone threshold stays flush enough to walk through without a jump. */}
        <Box
          p={[cx, 0.02, cz + 13.3]}
          s={[6, 0.08, 1.1]}
          color="#b7b6a1"
          material="stone"
        />
        <Box
          p={[cx, 0.02, cz - 13.3]}
          s={[6, 0.08, 1.1]}
          color="#b7b6a1"
          material="stone"
        />
        <Box
          p={[cx, 4.4, cz + 13]}
          s={[6.2, 0.17, 0.19]}
          color={IRON}
          material="metal"
        />
        <Box
          p={[cx, 4.4, cz - 13]}
          s={[6.2, 0.17, 0.19]}
          color={IRON}
          material="metal"
        />
        {[-1, 1].map((side) => (
          <group key={side}>
            {[10.3, -10.3].map((z) => (
              <group key={z}>
                <Box
                  p={[side * 9.8, 0.36, cz + z]}
                  s={[2.7, 0.72, 2.5]}
                  color="#886c51"
                  material="wood"
                />
                <Box
                  p={[side * 9.8, 0.73, cz + z]}
                  s={[2.8, 0.1, 2.6]}
                  color="#675e47"
                  material="wood"
                />
              </group>
            ))}
          </group>
        ))}
        {pipes.map((points, i) => (
          <Pipe key={i} points={points} />
        ))}
        <Box
          p={[heartStart.x, 0.18, heartStart.z]}
          s={[2.9, 0.36, 2.9]}
          color="#8c917b"
          material="stone"
        />
        <Box
          p={[0, 0.14, -46]}
          s={[2.3, 0.28, 2.3]}
          color="#b5ae94"
          material="stone"
        />
      </StaticGeometry>
      {/* These panes retain sky/environment reflections and small roughness variations. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * 12, 2.4, cz]}
            rotation={[0, Math.PI / 2, 0]}
            material={glassMaterial()}
            dispose={null}
          >
            <planeGeometry args={[25.8, 4.05]} />
          </mesh>
          {[-13, 13].map((z) => (
            <mesh
              key={z}
              position={[side * 7.5, 2.4, cz + z]}
              material={glassMaterial()}
              dispose={null}
            >
              <planeGeometry args={[8.8, 4.05]} />
            </mesh>
          ))}
        </group>
      ))}
      <Sign
        text="BELLWEATHER"
        p={[0, 3.85, cz + 13.15]}
        width={3.7}
        color="#e9d9aa"
        background="#304940"
      />
      <HingedEntrance z={cz + 13.1} />
      <HingedEntrance z={cz - 13.1} />
      <PlantBeds />
    </group>
  );
});

/** Individual worn paving and canal coping share one draw and one photographed surface. */
const HollowMasonry = memo(function HollowMasonry() {
  const mesh = useRef<T.InstancedMesh>(null);
  const stones = useMemo(() => {
    const result: { p: Triple; s: Triple; angle: number }[] = [];
    for (let x = -11.5; x < 12; x++)
      for (let z = -62.5; z < -37; z++)
        result.push({ p: [x, -0.005, z], s: [0.985, 0.05, 0.985], angle: 0 });
    for (const z of [11.96, 18.04])
      for (let x = -58.1; x <= -33.8; x += 0.82)
        result.push({ p: [x, 0.075, z], s: [0.8, 0.22, 0.36], angle: 0 });
    for (const x of [-65.04, -58.96])
      for (let z = -6.4; z <= 11.4; z += 0.82)
        result.push({ p: [x, 0.075, z], s: [0.36, 0.22, 0.8], angle: 0 });
    for (const p of waterReceivers)
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const x = p.x + Math.cos(a) * 3.86,
          z = p.z + Math.sin(a) * 3.86;
        // Where the channel meets its settling pools, leave the waterway open.
        if (
          (z > 12.2 && z < 17.8 && x > -61.8 && x < -33.5) ||
          (x > -64.8 && x < -59.2 && z > -9.8 && z < 14.8)
        )
          continue;
        result.push({
          p: [x, 0.075, z],
          s: [0.65, 0.22, 0.36],
          angle: -a + Math.PI / 2,
        });
      }
    return result;
  }, []);
  const material = useMemo(() => {
    const m = new T.MeshStandardMaterial({
      ...pbrTextures("stone"),
      color: "#aab6ad",
      roughness: 0.9,
      normalScale: new T.Vector2(0.45, 0.45),
    });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #include <map_fragment>
        float stoneLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(stoneLuma)*vec3(.94,1.,.95),.83)*1.55;
      `,
      );
    };
    m.customProgramCacheKey = () => "hollow-grey-limestone-v1";
    return m;
  }, []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const o = new T.Object3D(),
      color = new T.Color();
    stones.forEach((stone, i) => {
      o.position.fromArray(stone.p);
      o.scale.fromArray(stone.s);
      o.rotation.set(0, stone.angle, 0);
      o.updateMatrix();
      mesh.current!.setMatrixAt(i, o.matrix);
      mesh.current!.setColorAt(
        i,
        color.setScalar(0.83 + rand(i + 2900) * 0.17),
      );
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [stones]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, material, stones.length]}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
});

function HingedEntrance({ z }: { z: number }) {
  const left = useRef<T.Group>(null),
    right = useRef<T.Group>(null);
  useFrame((_, dt) => {
    const local = net.local,
      peer = net.motion.sample(performance.now());
    const close =
      Math.hypot(local.x, local.z - z) < 8 ||
      (!!peer && net.snapshot.peer && Math.hypot(peer.x, peer.z - z) < 8);
    for (const [ref, side] of [
      [left, -1],
      [right, 1],
    ] as const)
      if (ref.current)
        ref.current.rotation.y = T.MathUtils.damp(
          ref.current.rotation.y,
          close ? side * 1.5 : 0,
          4.8,
          Math.min(dt, 0.05),
        );
  });
  return (
    <>
      {[-1, 1].map((side) => (
        <group
          key={side}
          ref={side < 0 ? left : right}
          position={[side * 3, 0, z]}
        >
          <StaticGeometry>
            <Box
              p={[-side * 1.5, 0.58, 0]}
              s={[2.9, 1.12, 0.12]}
              color="#686d52"
              material="wood"
            />
            {[-side * 0.06, -side * 2.94].map((x) => (
              <Box
                key={x}
                p={[x, 2.15, 0]}
                s={[0.12, 4.25, 0.15]}
                color={IRON}
                material="metal"
              />
            ))}
            {[1.15, 4.25].map((y) => (
              <Box
                key={y}
                p={[-side * 1.5, y, 0]}
                s={[2.9, 0.12, 0.15]}
                color={IRON}
                material="metal"
              />
            ))}
            <Pole
              p={[-side * 2.7, 1.42, 0.17]}
              r={0.035}
              h={0.32}
              color={BRASS}
            />
          </StaticGeometry>
          <mesh
            position={[-side * 1.5, 2.68, 0.005]}
            material={glassMaterial()}
            dispose={null}
          >
            <planeGeometry args={[2.76, 2.94]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

const PlantBeds = memo(function PlantBeds() {
  const fern = useMemo(() => {
    const t = new T.TextureLoader().load("/textures/woodland-fern.webp");
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => () => fern.dispose(), [fern]);
  const stems = useRef<T.InstancedMesh>(null),
    flowers = useRef<T.InstancedMesh>(null);
  useEffect(() => {
    if (!stems.current || !flowers.current) return;
    const o = new T.Object3D(),
      c = new T.Color();
    for (let i = 0; i < 64; i++) {
      const corner = Math.floor(i / 16),
        side = corner % 2 ? 1 : -1,
        z = corner < 2 ? -39.7 : -60.3;
      o.position.set(
        side * 9.8 + (rand(i + 144) - 0.5) * 2.3,
        0.97 + rand(i) * 0.3,
        z + (rand(i + 422) - 0.5) * 2.1,
      );
      o.rotation.set(-0.2, rand(i + 12) * 6.28, 0.05);
      o.scale.set(1.1, 1.2 + rand(i) * 0.6, 1);
      o.updateMatrix();
      stems.current.setMatrixAt(i, o.matrix);
      o.position.y += 0.2;
      o.scale.set(0.04, 0.06, 0.04);
      o.updateMatrix();
      flowers.current.setMatrixAt(i, o.matrix);
      flowers.current.setColorAt(i, c.set(i % 3 ? "#eadfa7" : "#cc967c"));
    }
    for (const m of [stems.current, flowers.current]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
    flowers.current.instanceColor!.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={stems} args={[undefined, undefined, 64]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={fern}
          color="#9ea980"
          alphaTest={0.4}
          side={T.DoubleSide}
          roughness={0.9}
        />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, 64]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial
          roughness={0.7}
          emissive="#d3a963"
          emissiveIntensity={0.12}
        />
      </instancedMesh>
    </>
  );
});

function OpeningRoof({ assembly }: { assembly: number }) {
  const left = useRef<T.Group>(null),
    right = useRef<T.Group>(null);
  const glassHalves = useMemo(
    () =>
      [-1, 1].map((side) => {
        const g = new T.BufferGeometry();
        g.setAttribute(
          "position",
          new T.Float32BufferAttribute(
            [0, 0, -13, -side * 12, 4, -13, -side * 12, 4, 13, 0, 0, 13],
            3,
          ),
        );
        g.setAttribute(
          "uv",
          new T.Float32BufferAttribute([0, 0, 1, 0, 1, 2, 0, 2], 2),
        );
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        return g;
      }),
    [],
  );
  useEffect(() => () => glassHalves.forEach((g) => g.dispose()), [glassHalves]);
  useFrame((_, dt) => {
    const progress = assembly / 3;
    if (left.current)
      left.current.rotation.z = T.MathUtils.damp(
        left.current.rotation.z,
        0.72 * progress,
        0.85,
        dt,
      );
    if (right.current)
      right.current.rotation.z = T.MathUtils.damp(
        right.current.rotation.z,
        -0.72 * progress,
        0.85,
        dt,
      );
  });
  return (
    <>
      {[-1, 1].map((side, i) => (
        <group
          key={side}
          ref={side < 0 ? left : right}
          position={[side * 12, 4.4, conservatory.z]}
        >
          <mesh
            geometry={glassHalves[i]}
            material={glassMaterial()}
            dispose={null}
          />
          <StaticGeometry>
            {[-13, -8.6, -4.3, 0, 4.3, 8.6, 13].map((z) => (
              <Box
                key={z}
                p={[-side * 6, 2, z]}
                s={[12.65, 0.14, 0.14]}
                rot={[0, 0, -side * Math.atan(1 / 3)]}
                color={IRON}
                material="metal"
              />
            ))}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <Box
                key={t}
                p={[-side * 12 * t, 4 * t, 0]}
                s={[0.1, 0.1, 26]}
                color={IRON}
                material="metal"
              />
            ))}
            <Box
              p={[0, -0.03, 0]}
              s={[0.27, 0.22, 26.2]}
              color={BRASS}
              material="metal"
            />
          </StaticGeometry>
        </group>
      ))}
    </>
  );
}

const WATER_SHADER = {
  name: "BellweatherCanal",
  uniforms: {
    ...T.UniformsLib.fog,
    color: { value: new T.Color("#345d53") },
    tDiffuse: { value: null },
    textureMatrix: { value: new T.Matrix4() },
    time: { value: 0 },
    calm: { value: 0 },
  },
  vertexShader: `uniform mat4 textureMatrix;varying vec4 reflectedUv;varying vec3 waterWorld;
    #include <common>
    #include <fog_pars_vertex>
    void main(){waterWorld=(modelMatrix*vec4(position,1.)).xyz;reflectedUv=textureMatrix*vec4(position,1.);vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float time;uniform float calm;varying vec4 reflectedUv;varying vec3 waterWorld;
    #include <common>
    #include <fog_pars_fragment>
    void main(){vec2 p=waterWorld.xz;float strength=mix(.013,.004,calm);vec2 bend=vec2(sin(p.y*2.7+time*1.8)+sin(p.x*1.9-time),cos(p.x*2.1-time*1.2))*strength;vec4 uv=reflectedUv;uv.xy+=bend*uv.w;vec3 mirrored=texture2DProj(tDiffuse,uv).rgb;vec3 view=normalize(cameraPosition-waterWorld);float fresnel=.18+.69*pow(1.-max(0.,view.y),2.3);vec3 body=mix(vec3(.018,.075,.074),vec3(.05,.12,.1),calm);vec3 col=mix(body,mirrored,fresnel);float rings=pow(max(0.,sin(length(p-vec2(-62.,15.))*6.-time*2.1)),18.)*.015*(1.-calm*.7);gl_FragColor=vec4(col+rings,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    }`,
};
function CanalWater({
  restored,
  quality,
}: {
  restored: number;
  quality: string;
}) {
  const reflector = useMemo(() => {
    const sections = [
      new T.PlaneGeometry(29, 5.8).translate(-48, -15, 0),
      new T.PlaneGeometry(5.8, 24).translate(-62, -2, 0),
      ...waterReceivers.map((p) =>
        new T.CircleGeometry(3.8, 40).translate(p.x, -p.z, 0),
      ),
    ];
    const g = mergeGeometries(sections)!;
    sections.forEach((p) => p.dispose());
    const water = new Reflector(g, {
      textureWidth: quality === "low" ? 256 : 512,
      textureHeight: quality === "low" ? 256 : 512,
      clipBias: 0.0025,
      multisample: 0,
      shader: WATER_SHADER,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.025;
    (water.material as T.ShaderMaterial).fog = true;
    const render = water.onBeforeRender;
    let at = -Infinity;
    water.onBeforeRender = function (
      renderer,
      scene,
      camera,
      geometry,
      material,
      group,
    ) {
      if (camera.userData.autumnReflection) return;
      const now = performance.now(),
        far = Math.hypot(camera.position.x + 50, camera.position.z) > 70;
      if (now - at < (far ? 180 : quality === "low" ? 120 : 65)) return;
      at = now;
      const hands = scene.getObjectByName("first-person-hands"),
        local = scene.getObjectByName("local-avatar"),
        previousHands = hands?.visible,
        previousLocal = local?.visible;
      if (hands) hands.visible = false;
      if (local) local.visible = true;
      water.getReflectionCamera(camera).userData.autumnReflection = true;
      try {
        render.call(water, renderer, scene, camera, geometry, material, group);
      } finally {
        if (hands) hands.visible = !!previousHands;
        if (local) local.visible = !!previousLocal;
      }
    };
    return water;
  }, [quality]);
  useEffect(
    () => () => {
      reflector.geometry.dispose();
      reflector.dispose();
    },
    [reflector],
  );
  useFrame(({ clock }, dt) => {
    const u = (reflector.material as T.ShaderMaterial).uniforms;
    u.time.value = clock.elapsedTime;
    u.calm.value = T.MathUtils.damp(u.calm.value, restored / 3, 0.8, dt);
  });
  return <primitive object={reflector} dispose={null} />;
}

function Gauge({
  value,
  target,
  position,
}: {
  value: () => number;
  target?: () => number;
  position: Triple;
}) {
  const pointer = useRef<T.Group>(null),
    gold = useRef<T.Group>(null);
  useFrame(() => {
    if (pointer.current) pointer.current.rotation.z = -value() * 1.1;
    if (gold.current && target) gold.current.rotation.z = -target() * 1.1;
  });
  return (
    <group position={position}>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        material={copperMaterial()}
        dispose={null}
      >
        <cylinderGeometry args={[0.41, 0.43, 0.08, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.046]}>
        <circleGeometry args={[0.36, 40]} />
        <meshStandardMaterial color="#ddd8bb" roughness={0.85} />
      </mesh>
      <group ref={gold}>
        {target && (
          <mesh position={[0, 0.286, 0.054]}>
            <boxGeometry args={[0.12, 0.06, 0.006]} />
            <meshStandardMaterial
              color="#d5a951"
              emissive="#ddb356"
              emissiveIntensity={0.3}
            />
          </mesh>
        )}
      </group>
      <group ref={pointer}>
        <mesh position={[0, 0.14, 0.064]}>
          <boxGeometry args={[0.018, 0.31, 0.008]} />
          <meshStandardMaterial
            color="#2c4948"
            metalness={0.4}
            roughness={0.45}
          />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.075]} material={copperMaterial()} dispose={null}>
        <sphereGeometry args={[0.035, 10, 8]} />
      </mesh>
    </group>
  );
}

function Waterworks({ expedition: e }: { expedition: Expedition }) {
  const wheel = useRef<T.Group>(null),
    turbines = useRef<(T.Group | null)[]>([]),
    lids = useRef<(T.Group | null)[]>([]);
  const value = useRef(0);
  useFrame(({ clock }, dt) => {
    const desired = e.operator?.route === "water" ? e.operator.value : 0;
    value.current = T.MathUtils.damp(value.current, desired, 10, dt);
    if (wheel.current) wheel.current.rotation.z = value.current * 3.3;
    for (let i = 0; i < 3; i++) {
      const charge = e.waterCharge[i],
        done = e.water.includes(i);
      if (turbines.current[i])
        turbines.current[i]!.rotation.z += dt * (0.15 + charge * 0.6);
      if (lids.current[i])
        lids.current[i]!.position.y = T.MathUtils.damp(
          lids.current[i]!.position.y,
          done ? 1.8 : charge * 0.8,
          2,
          dt,
        );
    }
  });
  return (
    <group name="hollow-waterworks">
      <group
        position={[expeditionControls.water.x, 0, expeditionControls.water.z]}
      >
        <StaticGeometry>
          <Box
            p={[0, 0.4, 0]}
            s={[2.3, 0.8, 1.8]}
            color={STONE}
            material="stone"
          />
          <Pole p={[0, 1.25, 0]} r={0.23} h={1.3} color={IRON} />
          <Box
            p={[0, 1.7, 0]}
            s={[1.8, 0.15, 0.7]}
            color={BRASS}
            material="metal"
          />
        </StaticGeometry>
        <group ref={wheel} position={[0, 1.2, 0.64]}>
          <Ring radius={0.58} thickness={0.055} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Box
              key={i}
              p={[
                Math.sin((i * Math.PI) / 3) * 0.29,
                Math.cos((i * Math.PI) / 3) * 0.29,
                0,
              ]}
              s={[0.045, 0.6, 0.045]}
              rot={[0, 0, (-i * Math.PI) / 3]}
              color={BRASS}
              material="metal"
            />
          ))}
          <Pole
            p={[0.53, 0, 0.1]}
            r={0.065}
            h={0.24}
            rotation={[Math.PI / 2, 0, 0]}
            color="#4b5f4f"
          />
        </group>
        <Gauge position={[0, 2.12, 0.1]} value={() => value.current} />
        <Sign text="WATERWORKS" p={[0, 2.85, 0]} width={2.3} />
      </group>
      {waterReceivers.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <StaticGeometry>
            <Box
              p={[0, 0.16, 0]}
              s={[2.6, 0.32, 2.6]}
              color={STONE}
              material="stone"
            />
            {[-1, 1].map((side) => (
              <Box
                key={side}
                p={[side * 1.18, 1.25, -0.1]}
                s={[0.12, 2.3, 0.12]}
                color={IRON}
                material="metal"
              />
            ))}
            <Box
              p={[0, 2.43, -0.1]}
              s={[2.5, 0.14, 0.18]}
              color={IRON}
              material="metal"
            />
          </StaticGeometry>
          <group
            ref={(g) => {
              turbines.current[i] = g;
            }}
            position={[0, 0.65, -1.33]}
          >
            <Ring radius={0.65} thickness={0.09} />
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <Box
                key={j}
                p={[
                  Math.sin((j * Math.PI) / 3) * 0.36,
                  Math.cos((j * Math.PI) / 3) * 0.36,
                  0,
                ]}
                s={[0.15, 0.72, 0.25]}
                rot={[0, 0, (-j * Math.PI) / 3]}
                color="#6e6851"
                material="wood"
              />
            ))}
          </group>
          <group
            ref={(g) => {
              lids.current[i] = g;
            }}
          >
            <mesh
              position={[0, 1.02, 0]}
              material={glassMaterial()}
              dispose={null}
            >
              <cylinderGeometry args={[0.52, 0.83, 1.45, 32, 1, true]} />
            </mesh>
            <Ring
              position={[0, 1.75, 0]}
              radius={0.52}
              rotation={[Math.PI / 2, 0, 0]}
              thickness={0.045}
            />
          </group>
          {!e.water.includes(i) && (
            <mesh position={[0, 0.8, 0]}>
              <dodecahedronGeometry args={[0.35, 1]} />
              <meshPhysicalMaterial
                color="#b3d4c2"
                metalness={0.1}
                roughness={0.12}
                clearcoat={1}
                emissive="#83b0a3"
                emissiveIntensity={0.2 + e.waterCharge[i] * 0.6}
              />
            </mesh>
          )}
          <Gauge
            position={[0, 1.4, 1.45]}
            value={() => value.current}
            target={() => waterTarget(i, Date.now() + net.clockOffset)}
          />
          <Lantern
            position={[1.65, 0.17, 0.9]}
            scale={0.6}
            color={e.water.includes(i) ? "#9dcbb6" : "#cbaf78"}
            lit={e.water.includes(i)}
          />
        </group>
      ))}
    </group>
  );
}

function LanternTrail({ expedition: e }: { expedition: Expedition }) {
  const receivers = useRef<(T.Group | null)[]>([]),
    handles = useRef<(T.Group | null)[]>([]),
    lamp = useRef<T.Group>(null),
    beam = useRef<T.Mesh>(null),
    spot = useRef<T.Mesh>(null),
    illumination = useRef<T.SpotLight>(null);
  const lightTarget = useMemo(() => new T.Object3D(), []);
  const scratch = useMemo(
    () => ({
      direction: new T.Vector3(),
      origin: new T.Vector3(),
      endpoint: new T.Vector3(),
      down: new T.Vector3(0, -1, 0),
    }),
    [],
  );
  const beamGeometry = useMemo(
    () =>
      new T.CylinderGeometry(0.001, 1, 1, 24, 1, true).translate(0, -0.5, 0),
    [],
  );
  useEffect(() => () => beamGeometry.dispose(), [beamGeometry]);
  useFrame(({ clock }, dt) => {
    const now = Date.now() + net.clockOffset;
    lightReceivers.forEach((p, i) => {
      const target = lightReceiver(i, now),
        group = receivers.current[i];
      if (group) {
        group.position.set(target.x - p.x, target.y, target.z - p.z);
        group.rotation.y = clock.elapsedTime * 0.12 + i;
        group.visible = !e.light.includes(i);
      }
      const handle = handles.current[i];
      if (handle)
        handle.rotation.z = T.MathUtils.damp(
          handle.rotation.z,
          (e.receiver?.index === i ? e.receiver.value : 0) * 3,
          12,
          dt,
        );
    });
    const active = e.operator?.route === "light";
    if (lamp.current) lamp.current.visible = !active;
    if (illumination.current)
      illumination.current.intensity = T.MathUtils.damp(
        illumination.current.intensity,
        active ? 1100 : 0,
        12,
        dt,
      );
    if (beam.current) beam.current.visible = !!active;
    if (spot.current) spot.current.visible = !!active;
    if (!active || !beam.current || !spot.current) return;
    const op = e.operator!,
      pose =
        op.role === net.snapshot.role
          ? net.local
          : net.motion.sample(performance.now()) || net.poses[op.role];
    if (!pose) {
      beam.current.visible = spot.current.visible = false;
      if (illumination.current) illumination.current.intensity = 0;
      return;
    }
    const yaw = op.role === net.snapshot.role ? input.yaw : pose.yaw,
      pitch = op.role === net.snapshot.role ? input.pitch : pose.pitch;
    scratch.origin.set(pose.x, pose.y + 1.65, pose.z);
    scratch.direction.set(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    const target = lightReceiver(op.index, now),
      distance = Math.min(
        66,
        Math.hypot(
          target.x - pose.x,
          target.y - pose.y - 1.65,
          target.z - pose.z,
        ),
      );
    beam.current.position.copy(scratch.origin);
    beam.current.quaternion.setFromUnitVectors(scratch.down, scratch.direction);
    beam.current.scale.set(distance * 0.054, distance, distance * 0.054);
    scratch.endpoint
      .copy(scratch.origin)
      .addScaledVector(scratch.direction, distance);
    lightTarget.position.copy(scratch.endpoint);
    lightTarget.updateMatrixWorld();
    illumination.current?.position.copy(scratch.origin);
    spot.current.position.copy(scratch.endpoint);
    spot.current.quaternion.copy(beam.current.quaternion);
    spot.current.rotateX(Math.PI / 2);
    const aligned =
      receiverAlignment({ ...pose, yaw, pitch }, target) > Math.cos(0.075);
    (spot.current.material as T.MeshBasicMaterial).opacity = aligned
      ? 0.6
      : 0.12;
    if (lamp.current) {
      lamp.current.rotation.y = yaw;
      lamp.current.rotation.x = pitch;
    }
  });
  return (
    <group name="hollow-lantern-trail">
      <primitive object={lightTarget} />
      <spotLight
        ref={illumination}
        target={lightTarget}
        color="#ffe0a6"
        intensity={0}
        distance={85}
        angle={0.085}
        penumbra={0.6}
        decay={2}
      />
      <group
        position={[expeditionControls.light.x, 0, expeditionControls.light.z]}
      >
        <StaticGeometry>
          <Box
            p={[0, 0.4, 0]}
            s={[2.3, 0.8, 1.8]}
            color={STONE}
            material="stone"
          />
          <Pole p={[0, 0.88, 0]} r={0.11} h={0.65} color={BRASS} />
          <Box
            p={[0, 1.18, 0]}
            s={[1.2, 0.17, 0.7]}
            color={IRON}
            material="metal"
          />
        </StaticGeometry>
        <group ref={lamp} position={[0, 1.35, 0]}>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            material={copperMaterial()}
            dispose={null}
          >
            <cylinderGeometry args={[0.22, 0.27, 0.65, 24]} />
          </mesh>
          <mesh position={[0, 0, -0.34]}>
            <circleGeometry args={[0.21, 32]} />
            <meshStandardMaterial
              color="#e5ddb3"
              emissive="#d8d8a2"
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
        <Sign text="LANTERN TRAIL" p={[0, 2.8, 0]} width={2.7} />
      </group>
      {lightReceivers.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <StaticGeometry>
            <Box
              p={[0, 0.16, 0]}
              s={[2.8, 0.32, 2.5]}
              color={STONE}
              material="stone"
            />
            <Pole p={[0, 0.75, 0]} r={0.11} h={1.2} color={BRASS} />
            <Box
              p={[0, 1.36, 0]}
              s={[1.2, 0.16, 0.6]}
              color={IRON}
              material="metal"
            />
          </StaticGeometry>
          <group
            ref={(g) => {
              handles.current[i] = g;
            }}
            position={[0, 1.14, 0.45]}
          >
            <Ring radius={0.4} thickness={0.04} />
            <Box s={[0.74, 0.04, 0.04]} color={BRASS} material="metal" />
            <Pole
              p={[0.36, 0, 0.12]}
              r={0.045}
              h={0.23}
              rotation={[Math.PI / 2, 0, 0]}
              color="#38564a"
            />
          </group>
          <Gauge
            position={[0, 1.86, 0.08]}
            value={() => (e.receiver?.index === i ? e.receiver.value : 0)}
            target={() => focusTarget(i, Date.now() + net.clockOffset)}
          />
          <group
            ref={(g) => {
              receivers.current[i] = g;
            }}
          >
            <Ring radius={0.48} thickness={0.035} />
            <mesh>
              <octahedronGeometry args={[0.3, 1]} />
              <meshPhysicalMaterial
                color="#d2c79c"
                roughness={0.08}
                metalness={0.1}
                clearcoat={1}
                emissive="#ffd89b"
                emissiveIntensity={0.35 + e.lightCharge[i] * 0.9}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.38, 0.013, 6, 32]} />
              <meshBasicMaterial color="#f8d594" toneMapped={false} />
            </mesh>
          </group>
          <Lantern
            position={[1.7, 0.16, 0.8]}
            color="#ffdb9c"
            scale={0.6}
            lit={e.light.includes(i)}
          />
        </group>
      ))}
      <mesh
        ref={beam}
        visible={false}
        frustumCulled={false}
        geometry={beamGeometry}
      >
        <meshBasicMaterial
          color="#fae1a4"
          transparent
          opacity={0.048}
          blending={T.AdditiveBlending}
          depthWrite={false}
          side={T.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={spot} visible={false}>
        <ringGeometry args={[0.23, 0.31, 32]} />
        <meshBasicMaterial
          color="#ffe2a4"
          transparent
          opacity={0.5}
          blending={T.AdditiveBlending}
          depthWrite={false}
          side={T.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function GlassHeart({ expedition: e }: { expedition: Expedition }) {
  const root = useRef<T.Group>(null),
    core = useRef<T.Mesh>(null),
    cage = useRef<T.Group>(null);
  const destination = useMemo(() => new T.Vector3(), []);
  const active = expeditionPathsComplete(e);
  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    root.current.visible = active;
    const installed = e.carry.delivered,
      raised = e.assembly / 3;
    const x = installed ? 0 : e.carry.x,
      z = installed
        ? T.MathUtils.lerp(-46, assemblyFocus.z, raised)
        : e.carry.z,
      y = installed
        ? T.MathUtils.lerp(1.15, assemblyFocus.y, raised)
        : e.carry.holders.length === 2
          ? 1.15
          : 1;
    root.current.position.lerp(
      destination.set(x, y, z),
      1 - Math.exp(-dt * 10),
    );
    if (core.current) core.current.rotation.y = clock.elapsedTime * 0.18;
    if (cage.current)
      cage.current.rotation.y = installed ? clock.elapsedTime * 0.05 : 0;
  });
  const color = e.firstRoute === "water" ? "#b0e0cf" : "#f4d6a2";
  return (
    <>
      <group
        ref={root}
        name="shared-glass-heart"
        position={[e.carry.x, 1, e.carry.z]}
        visible={active}
      >
        <LocalLightSource
          color={color}
          radius={0.18}
          intensity={9 + e.assembly * 2}
          range={7}
          flicker={0.012}
          enabled={active}
        />
        <mesh ref={core}>
          <icosahedronGeometry args={[0.63, 1]} />
          <meshPhysicalMaterial
            color={color}
            roughness={0.14}
            metalness={0.15}
            clearcoat={1}
            emissive={color}
            emissiveIntensity={0.24 + e.assembly * 0.18}
          />
        </mesh>
        <group ref={cage}>
          <Ring radius={0.76} thickness={0.025} />
          <Ring
            radius={0.76}
            thickness={0.025}
            rotation={[0, Math.PI / 2, 0]}
          />
          <Ring
            radius={0.76}
            thickness={0.025}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.94, 0, 0]}>
            <Ring
              radius={0.16}
              thickness={0.04}
              rotation={[0, Math.PI / 2, 0]}
            />
            <Box
              p={[-side * 0.1, 0, 0]}
              s={[0.25, 0.04, 0.06]}
              color={BRASS}
              material="metal"
            />
          </group>
        ))}
      </group>
      {active &&
        !e.carry.delivered &&
        carryWaypoints.map((p, i) => (
          <group key={i} position={[p.x, 0.015, p.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.25, 1.45, 40]} />
              <meshStandardMaterial
                color={
                  i < e.carry.checkpoint
                    ? "#b5c9af"
                    : i === e.carry.checkpoint
                      ? "#cbaa6b"
                      : "#61715c"
                }
                roughness={0.8}
                emissive={i === e.carry.checkpoint ? "#b08c47" : "#1b2d28"}
                emissiveIntensity={i === e.carry.checkpoint ? 0.45 : 0}
              />
            </mesh>
            <Lantern
              position={[1.8, 0, 0]}
              scale={0.45}
              color={color}
              lit={i <= e.carry.checkpoint}
            />
          </group>
        ))}
    </>
  );
}

function AssemblyStations({ expedition: e }: { expedition: Expedition }) {
  const orrery = useRef<T.Group>(null);
  useFrame(({ clock }) => {
    if (orrery.current)
      orrery.current.rotation.y =
        clock.elapsedTime * (0.025 + e.assembly * 0.018);
  });
  return (
    <group name="conservatory-assembly">
      <group
        position={[assemblyFocus.x, assemblyFocus.y, assemblyFocus.z]}
        ref={orrery}
      >
        <Ring radius={1.3} thickness={0.035} rotation={[0.3, 0, 0.3]} />
        <Ring
          radius={1.16}
          thickness={0.025}
          rotation={[Math.PI / 2, 0.2, 0]}
        />
        {e.assembly < 3 && (
          <mesh>
            <octahedronGeometry args={[0.12, 0]} />
            <meshBasicMaterial color="#e8cf91" toneMapped={false} />
          </mesh>
        )}
      </group>
      {assemblyPads.map((pair, i) =>
        pair.map((p, role) => (
          <group key={`${i}-${role}`} position={[p.x, 0, p.z]}>
            <StaticGeometry>
              <Box
                p={[0, 0.08, 0]}
                s={[1.8, 0.16, 1.6]}
                color={STONE}
                material="stone"
              />
              <Pole p={[0, 0.7, -0.5]} r={0.055} h={1.25} color={BRASS} />
              <Box
                p={[0, 1.3, -0.5]}
                s={[0.8, 0.12, 0.5]}
                color={IRON}
                material="metal"
              />
            </StaticGeometry>
            <Ring
              position={[0, 1.33, -0.48]}
              radius={0.24}
              thickness={0.025}
              rotation={[Math.PI / 3, 0, 0]}
            />
            <mesh position={[0, 0.168, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.5, 0.62, 32]} />
              <meshStandardMaterial
                color={role ? "#81bbae" : "#c9a365"}
                emissive={role ? "#81bbae" : "#c9a365"}
                emissiveIntensity={
                  e.carry.delivered && e.assembly === i
                    ? 0.65
                    : e.assembly > i
                      ? 0.15
                      : 0
                }
                roughness={0.7}
              />
            </mesh>
          </group>
        )),
      )}
      <group position={[returnPoint.x, 0, returnPoint.z]}>
        <Lantern
          position={[-2, 0.1, 0]}
          scale={0.9}
          color="#c5e8c6"
          lit={e.assembly === 3}
        />
        <Lantern
          position={[2, 0.1, 0]}
          scale={0.9}
          color="#f6d89b"
          lit={e.assembly === 3}
        />
      </group>
    </group>
  );
}

const Wayfinding = memo(function Wayfinding() {
  return (
    <>
      <StaticGeometry>
        <Pole p={[0, 1.4, 29]} r={0.1} h={2.8} />
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 4, 0, 54]}>
            <Pole p={[0, 2.4, 0]} r={0.16} h={4.8} />
            <Lantern
              position={[0, 2.6, 0]}
              color={side < 0 ? "#97c6b6" : "#e9cb91"}
              scale={0.9}
            />
          </group>
        ))}
        <Box
          p={[0, 4.82, 54]}
          s={[8.5, 0.22, 0.28]}
          color="#6a6249"
          material="wood"
        />
        <Box
          p={[lookout.x, 0.22, lookout.z]}
          s={[5, 0.44, 4]}
          color="#8c7553"
          material="wood"
        />
        <Box
          p={[lookout.x, 1.05, lookout.z - 1.7]}
          s={[4.8, 0.1, 0.12]}
          color="#79684a"
          material="wood"
        />
        <Box
          p={[lookout.x, 1.0, lookout.z]}
          s={[1.7, 0.12, 0.9]}
          color="#bba17b"
          material="wood"
        />
      </StaticGeometry>
      <Sign text="WATERWORKS  ←" p={[-1.35, 2.18, 29]} width={2.5} />
      <Sign text="→  LANTERN TRAIL" p={[1.3, 1.65, 29.025]} width={2.8} />
      <Sign text="THE HOLLOW" p={[0, 3.8, 54.17]} width={3.1} />
      <group position={[lookout.x, 1.16, lookout.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0.3]}>
          <planeGeometry args={[0.5, 0.75]} />
          <meshStandardMaterial
            color="#e4d6ac"
            side={T.DoubleSide}
            roughness={1}
          />
        </mesh>
        <Lantern position={[0.5, 0.03, 0]} scale={0.4} />
      </group>
    </>
  );
});

function HollowAtmosphere({ expedition: e }: { expedition: Expedition }) {
  const rain = useRef<T.InstancedMesh>(null),
    glints = useRef<T.InstancedMesh>(null),
    eventAt = useRef(-100),
    last = useRef(e.routeOrder.length),
    strength = useRef(1),
    object = useMemo(() => new T.Object3D(), []);
  const positions = useMemo(
    () =>
      Array.from({ length: 100 }, (_, i) => ({
        x: (rand(i + 330) - 0.5) * 50,
        y: rand(i + 337) * 15,
        z: (rand(i + 980) - 0.5) * 50,
        phase: rand(i + 770) * 6.28,
      })),
    [],
  );
  useEffect(() => {
    if (e.routeOrder.length > last.current) eventAt.current = performance.now();
    last.current = e.routeOrder.length;
  }, [e.routeOrder.length]);
  useFrame(({ clock, camera }, dt) => {
    strength.current = T.MathUtils.damp(
      strength.current,
      e.assembly === 3 ? 0 : 1 - e.water.length * 0.21,
      0.6,
      dt,
    );
    if (rain.current) {
      rain.current.visible = strength.current > 0.02;
      positions.forEach((p, i) => {
        object.position.set(
          camera.position.x + p.x,
          p.y + 8 - ((clock.elapsedTime * 8 + i) % 19),
          camera.position.z + p.z,
        );
        object.rotation.set(0.08, 0, 0.14);
        object.scale.set(0.008, 0.23 + rand(i) * 0.2, 0.008);
        object.updateMatrix();
        rain.current!.setMatrixAt(i, object.matrix);
      });
      rain.current.instanceMatrix.needsUpdate = true;
      (rain.current.material as T.MeshBasicMaterial).opacity =
        0.13 * strength.current;
    }
    if (glints.current) {
      const event = Math.max(
          0,
          1 - (performance.now() - eventAt.current) / 6500,
        ),
        warm = e.light.length / 3,
        opened = e.assembly / 3;
      glints.current.visible = event > 0 || warm > 0;
      positions.slice(0, 64).forEach((p, i) => {
        const rise = (clock.elapsedTime * 0.13 + i / 64) % 1;
        const center =
          e.firstRoute === "water"
            ? expeditionControls.water
            : expeditionControls.light;
        const mix = event > 0 ? 1 - event : 1;
        object.position.set(
          T.MathUtils.lerp(center.x, p.x * 0.58, mix) +
            Math.sin(clock.elapsedTime * 0.7 + p.phase),
          1.1 + rise * (2 + opened * 11) + event * 2,
          T.MathUtils.lerp(center.z, conservatory.z + p.z * 0.65, mix),
        );
        object.rotation.set(0, 0, 0);
        object.scale.setScalar(
          (0.022 + rand(i) * 0.025) *
            (event > 0 ? 1 : warm) *
            (0.6 + 0.4 * Math.sin(clock.elapsedTime * 2 + p.phase)),
        );
        object.updateMatrix();
        glints.current!.setMatrixAt(i, object.matrix);
      });
      glints.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh
        ref={rain}
        args={[undefined, undefined, 100]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#b8d7d2"
          transparent
          opacity={0.13}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={glints}
        args={[undefined, undefined, 64]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial
          color={e.firstRoute === "water" ? "#b8e0c8" : "#f4d298"}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}

/** Independent chapter scenery. Shared light, camera, controls, avatars and saves remain in World. */
export default function ExpeditionWorld({
  expedition,
  quality = "high",
}: {
  expedition: Expedition;
  quality?: string;
}) {
  return (
    <group name="bellweather-hollow">
      <ExpeditionLandscape />
      <FixedArchitecture />
      <HollowMasonry />
      <OpeningRoof assembly={expedition.assembly} />
      <CanalWater restored={expedition.water.length} quality={quality} />
      <Wayfinding />
      <Waterworks expedition={expedition} />
      <LanternTrail expedition={expedition} />
      <GlassHeart expedition={expedition} />
      {[-8, 8].flatMap((x) =>
        [-45, -55].map((z) => (
          <Lantern
            key={`${x}:${z}`}
            position={[x, 3, z]}
            scale={0.6}
            color="#e3cd94"
            lit={expedition.routeOrder.length > 0}
          />
        )),
      )}
      <AssemblyStations expedition={expedition} />
      <HollowAtmosphere expedition={expedition} />
    </group>
  );
}
