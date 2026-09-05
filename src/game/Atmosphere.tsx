import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  N8AO,
  Vignette,
  ToneMapping,
  FXAA,
} from "@react-three/postprocessing";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";
import type { Place } from "./content";
export function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl),
      room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.3;
    return () => {
      scene.environment = null;
      target.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}
export function Cinema({ lobby = false }: { lobby?: boolean }) {
  const [smooth, setSmooth] = useState(false);
  const sample = useRef({ frames: 0, time: 0, start: 0 });
  const { setDpr, gl, scene } = useThree();
  useFrame((s, dt) => {
    if (s.clock.elapsedTime < 12 || smooth) return;
    sample.current.frames++;
    sample.current.time += Math.min(dt, 0.1);
    if (sample.current.time > 5) {
      if (sample.current.frames / sample.current.time < 32) {
        setSmooth(true);
        setDpr(1);
      }
      sample.current.frames = 0;
      sample.current.time = 0;
    }
  });
  useEffect(() => {
    if (import.meta.env.DEV)
      Object.assign(window, { __mingyGraphics: { renderer: gl, scene } });
  }, [gl]);
  return (
    <EffectComposer multisampling={0} resolutionScale={smooth ? 0.7 : 1}>
      <N8AO
        enabled={!smooth && !lobby}
        aoRadius={0.4}
        intensity={1.35}
        distanceFalloff={1}
        halfRes
        quality="performance"
      />
      <Bloom
        luminanceThreshold={1.05}
        intensity={0.32}
        mipmapBlur
        luminanceSmoothing={0.4}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <FXAA />
      <Vignette offset={0.22} darkness={0.32} />
    </EffectComposer>
  );
}
const vertex = `varying vec2 vUv;varying vec3 vWorld;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*10.+uTime*1.5)*.008+cos(p.y*13.-uTime)*.007;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
export function Water({
  p = [0, 0.744, 3],
  radius = 1.15,
}: {
  p?: number[];
  radius?: number;
}) {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={p as any} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 72]} />
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={`varying vec2 vUv;varying vec3 vWorld;uniform float uTime;void main(){vec2 p=(vUv-.5)*2.;float d=length(p);float rings=sin(d*48.-uTime*3.);float ripple=pow(max(0.,rings),16.);float caustic=pow(abs(sin(p.x*19.+sin(p.y*15.+uTime))*.5+.5),12.);vec3 c=mix(vec3(.065,.22,.24),vec3(.24,.52,.49),.5+.22*sin(p.x*6.+p.y*3.));c+=vec3(.55,.69,.61)*ripple*.19+caustic*.08;float edge=smoothstep(.86,1.,d);c+=edge*vec3(.25,.32,.23);gl_FragColor=vec4(c,.94);}`}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
export function LightShafts({ place }: { place: Place }) {
  if (place === "garden" || place === "dream") return null;
  return (
    <group>
      {[-8, -4, 4, 8].map((x) => (
        <mesh
          key={x}
          position={[x - 1.2, 2, -7]}
          rotation={[-0.78, 0, -0.28]}
          renderOrder={2}
        >
          <planeGeometry args={[2.5, 7]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            uniforms={{
              tint: {
                value: new THREE.Color(place === "lab" ? "#84d9d1" : "#ffdb9a"),
              },
            }}
            vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
            fragmentShader="varying vec2 vUv;uniform vec3 tint;void main(){float a=pow(sin(vUv.x*3.14159),3.)*pow(vUv.y,1.4)*.075;gl_FragColor=vec4(tint,a);}"
          />
        </mesh>
      ))}
    </group>
  );
}
export function NightLandscape({ dream = false }: { dream?: boolean }) {
  const hills = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        x: Math.sin(i * 2.4) * 36,
        z: -20 - Math.abs(Math.cos(i * 2.4)) * 25,
        y: -8 + (i % 3),
        s: 5 + (i % 7),
      })),
    [],
  );
  return (
    <group>
      <mesh position={[12, 16, -36]}>
        <sphereGeometry args={[3.1, 48, 32]} />
        <meshBasicMaterial color={dream ? "#efd4c5" : "#eee6c5"} />
      </mesh>
      <mesh position={[12, 16, -36]}>
        <sphereGeometry args={[3.45, 32, 24]} />
        <meshBasicMaterial
          color="#efdbae"
          transparent
          opacity={0.07}
          depthWrite={false}
        />
      </mesh>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, h.y, h.z]} scale={[h.s, h.s * 0.8, h.s]}>
          <icosahedronGeometry args={[1, 2]} />
          <meshStandardMaterial
            color={i % 2 ? "#162e30" : "#1d3d3d"}
            roughness={1}
          />
        </mesh>
      ))}
      {Array.from({ length: 28 }, (_, i) => (
        <group key={i} position={[(i - 14) * 2.9, -1, -18 - (i % 3) * 3]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.13, 0.2, 4, 7]} />
            <meshStandardMaterial color="#202f2d" />
          </mesh>
          {[0, 1, 2].map((j) => (
            <mesh key={j} position={[0, 2 + j * 0.9, 0]}>
              <coneGeometry args={[1.7 - j * 0.35, 2.8, 9]} />
              <meshStandardMaterial color={i % 2 ? "#20483e" : "#193b37"} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
export function Aurora() {
  const ref = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={[0, 16, -29]}>
      <planeGeometry args={[70, 32]} />
      <shaderMaterial
        ref={ref}
        depthWrite={false}
        transparent
        uniforms={{ uTime: { value: 0 } }}
        vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
        fragmentShader={`varying vec2 vUv;uniform float uTime;void main(){float wave=.38+sin(vUv.x*8.+uTime*.1)*.1+sin(vUv.x*17.-uTime*.07)*.025;float band=exp(-abs(vUv.y-wave)*22.);float threads=.65+.35*sin(vUv.x*310.+sin(vUv.x*15.+uTime*.15)*8.);vec3 c=mix(vec3(.28,.73,.58),vec3(.64,.38,.74),vUv.x);gl_FragColor=vec4(c,band*threads*.3);}`}
      />
    </mesh>
  );
}
