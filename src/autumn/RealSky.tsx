import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as T from "three";
import {
  loadSkyPhotograph,
  loadSkyRadiance,
  peekSkyPhotograph,
  peekSkyRadiance,
} from "./skyAssets";

/** Photographic sky and matching HDR illumination, kept local to the game bundle. */
export function RealSky({
  night,
  rotation = 0,
}: {
  night: boolean;
  river?: boolean;
  progress?: number;
  rotation?: number;
}) {
  const { gl, scene } = useThree();
  const dome = useRef<T.Mesh>(null);
  const shader = useRef<T.ShaderMaterial>(null);
  const photograph = useRef<T.Texture | null>(null);
  const lighting = useRef<T.WebGLRenderTarget | null>(null);
  const initialized = useRef(false);
  const uniforms = useMemo(
    () => ({
      photograph: { value: null as T.Texture | null },
      photographReady: { value: 0 },
      evening: { value: night ? 1 : 0 },
      azimuth: { value: rotation },
    }),
    [],
  );
  useLayoutEffect(() => {
    let alive = true;
    let sky: T.Texture | null = null;
    let hdrFailed = false;
    let target: T.WebGLRenderTarget | null = null;
    const original = scene.environment;
    const originalIntensity = scene.environmentIntensity;
    const originalRotation = scene.environmentRotation.clone();
    const installEnvironment = (source: T.Texture) => {
      if (!alive || target) return;
      const radiance = source === sky ? source : source.clone();
      const generator = new T.PMREMGenerator(gl);
      try {
        generator.compileEquirectangularShader();
        radiance.mapping = T.EquirectangularReflectionMapping;
        target = generator.fromEquirectangular(radiance);
        scene.environment = target.texture;
        scene.environmentIntensity = T.MathUtils.lerp(
          0.55,
          0.065,
          uniforms.evening.value,
        );
        scene.environmentRotation.set(0, uniforms.azimuth.value, 0);
        lighting.current = target;
      } catch (error) {
        console.warn("The sky lighting could not be prepared.", error);
      } finally {
        if (radiance !== sky) radiance.dispose();
        generator.dispose();
      }
    };
    const installPhotograph = (source: T.Texture) => {
      if (!alive) return;
      sky = source.clone();
      // Retain the same photograph, sampling, color conversion and reveal animation.
      sky.colorSpace = T.SRGBColorSpace;
      sky.mapping = T.EquirectangularReflectionMapping;
      sky.wrapS = T.RepeatWrapping;
      sky.minFilter = T.LinearMipmapLinearFilter;
      sky.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      photograph.current = sky;
      initialized.current = true;
      if (hdrFailed) installEnvironment(sky);
    };
    const cachedPhotograph = peekSkyPhotograph();
    if (cachedPhotograph) installPhotograph(cachedPhotograph);
    else
      void loadSkyPhotograph()
        .then(installPhotograph)
        .catch((error) => {
          if (alive)
            console.warn("The sky texture could not be loaded.", error);
        });

    // A warmed HDR is installed synchronously before the first scene draw. PBR
    // materials therefore compile with their final environment from the outset.
    const cachedRadiance = peekSkyRadiance();
    if (cachedRadiance) installEnvironment(cachedRadiance);
    else
      void loadSkyRadiance()
        .then(installEnvironment)
        .catch(() => {
          if (!alive) return;
          hdrFailed = true;
          if (sky) installEnvironment(sky);
        });
    return () => {
      alive = false;
      initialized.current = false;
      photograph.current = null;
      if (shader.current) {
        shader.current.uniforms.photographReady.value = 0;
        shader.current.uniforms.photograph.value = null;
      }
      if (scene.environment === target?.texture) {
        scene.environment = original;
        scene.environmentIntensity = originalIntensity;
        scene.environmentRotation.copy(originalRotation);
      }
      lighting.current = null;
      target?.dispose();
      sky?.dispose();
    };
  }, [gl, scene, uniforms]);
  useFrame(({ camera, clock }, dt) => {
    if (dome.current) dome.current.position.copy(camera.position);
    // R3F/ShaderMaterial may copy the provided uniform definitions. Always drive
    // the live material instead of mutating the original React prop object.
    const live = shader.current?.uniforms;
    if (!live) return;
    live.photograph.value = photograph.current;
    live.photographReady.value = T.MathUtils.damp(
      live.photographReady.value,
      initialized.current ? 1 : 0,
      2.2,
      dt,
    );
    live.evening.value = T.MathUtils.damp(
      live.evening.value,
      night ? 1 : 0,
      0.3,
      dt,
    );
    // Approximately the real sky's apparent angular drift; the environment and
    // photograph move together, so polished surfaces never show a different sky.
    const angle = rotation + clock.elapsedTime * 0.000055;
    live.azimuth.value = angle;
    if (lighting.current && scene.environment === lighting.current.texture) {
      scene.environmentRotation.set(0, angle, 0);
      scene.environmentIntensity = T.MathUtils.lerp(
        0.55,
        0.065,
        live.evening.value,
      );
    }
  });
  return (
    <mesh
      name="photographic-sky"
      ref={dome}
      renderOrder={-1000}
      frustumCulled={false}
    >
      <sphereGeometry args={[290, 48, 24]} />
      <shaderMaterial
        ref={shader}
        toneMapped={false}
        side={T.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 skyDirection;
          void main() {
            skyDirection = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }
        `}
        fragmentShader={`
          uniform sampler2D photograph;
          uniform float photographReady;
          uniform float evening;
          uniform float azimuth;
          varying vec3 skyDirection;
          #include <common>
          void main() {
            vec3 d = normalize(skyDirection);
            float c = cos(azimuth), s = sin(azimuth);
            vec3 sampleDirection = vec3(c*d.x-s*d.z, d.y, s*d.x+c*d.z);
            vec3 captured = texture2D(photograph, equirectUv(sampleDirection)).rgb;
            float height = clamp(d.y, 0., 1.);
            vec3 fallback = mix(vec3(.51,.60,.66),vec3(.12,.29,.48),pow(height,.45));
            // The photograph remains the cloud structure at night. Only its
            // illumination changes, leaving a legible, continuous twilight.
            float luminance = dot(captured,vec3(.2126,.7152,.0722));
            vec3 moonlit = mix(captured*.075,vec3(.025,.045,.075)*(.4+luminance),.65);
            vec3 sky = mix(captured,moonlit,evening);
            vec3 haze = mix(vec3(.47,.52,.53),vec3(.025,.043,.065),evening);
            sky = mix(haze,sky,smoothstep(-.025,.025,d.y));
            gl_FragColor = vec4(mix(mix(fallback,fallback*.055,evening),sky,photographReady),1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `}
      />
    </mesh>
  );
}
