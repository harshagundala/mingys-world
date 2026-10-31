import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { pbrTextures } from "./materials";

const ORIGIN = new T.Vector3(94, 0, -68);
const fract = (n: number) => n - Math.floor(n);
const random = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const NOISE = `
float fallsHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fallsNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fallsHash(i),fallsHash(i+vec2(1.,0.)),f.x),mix(fallsHash(i+vec2(0.,1.)),fallsHash(i+vec2(1.)),f.x),f.y);}
`;

/** A rounded, fractured rock, with separate broad strata and fine erosion. */
function rockGeometry(seed: number, center: number[], size: number[]) {
  const g = new T.SphereGeometry(1, 20, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    // Evaluating the same function at coincident vertices keeps the UV seam closed.
    const broad = Math.sin(x * 4.2 + z * 2.3 + seed) * Math.cos(y * 3.8 - seed);
    const strata = Math.sin(y * 13.2 + Math.sin(z * 3.1) * 0.7 + seed) * 0.045;
    const wear =
      Math.sin(x * 15 + y * 9 + seed) * Math.sin(z * 11 - seed) * 0.025;
    const r = 1 + broad * 0.11 + strata + wear;
    // A superellipsoid gives shelves and vertical fractures, without faceted cones.
    const rounded = (n: number) => Math.sign(n) * Math.pow(Math.abs(n), 0.79);
    p.setXYZ(
      i,
      center[0] + rounded(x) * size[0] * r,
      center[1] + rounded(y) * size[1] * (1 + broad * 0.065),
      center[2] + rounded(z) * size[2] * r,
    );
  }
  g.computeVertexNormals();
  return g;
}

function cliffGeometry() {
  const rocks: T.BufferGeometry[] = [];
  const add = (center: number[], size: number[]) => {
    rocks.push(rockGeometry(rocks.length * 2.71, center, size));
  };
  // The whole landform is beyond the playable boundary. The central channel
  // steps backward uphill, leaving physical space in front of the wet rock face.
  add([8, 7.5, 0], [7, 8.1, 10.5]);
  add([6, 6.7, -12], [6, 7.1, 7]);
  add([7.5, 5.5, 12], [6.5, 6, 7.4]);
  add([3.8, 13.9, -3.9], [3.6, 3.6, 5.3]);
  add([5, 14.3, 4], [4, 3.2, 5.5]);
  add([2.5, 10.6, -8], [4, 2, 5.8]);
  add([3.1, 8.3, 7.4], [4.9, 2.1, 6]);
  add([1.3, 8, -0.7], [2.8, 1.5, 4.8]);
  add([0.2, 4.1, -5], [4.4, 2, 5.4]);
  add([2.8, 3.8, 5.4], [5.1, 2.7, 5.7]);
  add([-0.7, 1.4, 9.8], [4.3, 1.8, 3.6]);
  add([-1.8, 1.1, -10.6], [4.2, 1.4, 3.2]);
  add([3, 16.4, -2.7], [3.2, 1.15, 2.2]);
  add([3.3, 16, 2.9], [3.5, 1.2, 2.1]);
  add([4.6, 15.35, 0], [2.9, 1.3, 2.4]);
  for (let i = 0; i < 16; i++) {
    const z = (i % 2 ? -1 : 1) * (4 + random(i + 7) * 11);
    add(
      [-3.4 + random(i + 1) * 4.5, 0.25 + random(i + 3) * 1.2, z],
      [
        0.7 + random(i + 6) * 1.8,
        0.55 + random(i + 8) * 1.1,
        0.8 + random(i + 2) * 1.7,
      ],
    );
  }
  const merged = mergeGeometries(rocks)!;
  rocks.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

function curtainGeometry() {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const ribbons = [
    { z: 0, height: 16.5, width: 3.3, x: -0.6 },
    { z: -3.8, height: 14.2, width: 1.45, x: -1.7 },
    { z: 3.7, height: 11.4, width: 1.05, x: -2 },
  ];
  ribbons.forEach((r, ribbon) => {
    const start = positions.length / 3,
      nx = 12,
      ny = 56;
    for (let y = 0; y <= ny; y++) {
      const v = y / ny;
      // Water starts inside the upstream rock channel, rolls over its lip, then
      // separates into a gravity-driven curtain instead of beginning in midair.
      const centerX =
        r.x + 3.2 * Math.exp(-v * 28) - 5.15 * (1 - Math.exp(-v * 3.5));
      const width = r.width * (0.85 + v * 0.48);
      for (let x = 0; x <= nx; x++) {
        const u = x / nx,
          edge = u - 0.5;
        positions.push(
          centerX +
            Math.sin(u * 16 + v * 23 + ribbon) * 0.035 +
            edge * edge * 0.35,
          0.18 + r.height * (1 - v),
          r.z + edge * width + Math.sin(v * 13 + ribbon * 5) * 0.11,
        );
        uvs.push(ribbon * 2 + u, v);
        if (x < nx && y < ny) {
          const a = start + y * (nx + 1) + x;
          indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
        }
      }
    }
  });
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function cliffMaterial() {
  const material = new T.MeshStandardMaterial({
    ...pbrTextures("stone"),
    color: "#c2beb0",
    roughness: 0.86,
    normalScale: new T.Vector2(0.8, 0.8),
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 cliffPosition; varying vec3 cliffNormal;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
      #include <worldpos_vertex>
      cliffPosition=(modelMatrix*vec4(transformed,1.)).xyz;
      cliffNormal=normalize(mat3(modelMatrix)*objectNormal);
    `,
    );
    shader.fragmentShader =
      "varying vec3 cliffPosition; varying vec3 cliffNormal;\n" +
      NOISE +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      vec3 cN=normalize(cliffNormal);
      vec3 cW=pow(abs(cN),vec3(5.));cW/=max(.001,cW.x+cW.y+cW.z);
      vec3 cP=cliffPosition*.43;
      vec3 stoneTex=texture2D(map,cP.yz).rgb*cW.x+texture2D(map,cP.xz).rgb*cW.y+texture2D(map,cP.xy).rgb*cW.z;
      float channels=min(abs(cliffPosition.z+68.),min(abs(cliffPosition.z+71.8),abs(cliffPosition.z+64.3)));
      float cliffWet=(1.-smoothstep(.6,3.5,channels))*(1.-smoothstep(97.,101.,cliffPosition.x));
      cliffWet*=.68+.32*fallsNoise(vec2(cliffPosition.z*2.3,cliffPosition.y*.18));
      float strata=.94+.06*sin(cliffPosition.y*2.1+sin(cliffPosition.z*.35));
      float moss=smoothstep(.38,.74,fallsNoise(cliffPosition.zy*.55))*(.23+.77*smoothstep(.05,.65,cN.y));
      moss*=.3+cliffWet*.7;
      diffuseColor.rgb*=stoneTex*strata*mix(1.,.52,cliffWet);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.48,.66,.31),moss*.7);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      float rockRough=texture2D(roughnessMap,cP.yz).g*cW.x+texture2D(roughnessMap,cP.xz).g*cW.y+texture2D(roughnessMap,cP.xy).g*cW.z;
      float roughnessFactor=mix(max(.67,rockRough*roughness),.22,cliffWet);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      vec3 nx=texture2D(normalMap,cP.yz).xyz*2.-1.;
      vec3 ny=texture2D(normalMap,cP.xz).xyz*2.-1.;
      vec3 nz=texture2D(normalMap,cP.xy).xyz*2.-1.;
      nx.xy*=normalScale;ny.xy*=normalScale;nz.xy*=normalScale;
      nx=vec3(nx.z*cN.x,nx.x+cN.y,nx.y+cN.z);
      ny=vec3(ny.x+cN.x,ny.z*cN.y,ny.y+cN.z);
      nz=vec3(nz.x+cN.x,nz.y+cN.y,nz.z*cN.z);
      normal=normalize(mat3(viewMatrix)*normalize(nx*cW.x+ny*cW.y+nz*cW.z));
    `,
    );
  };
  material.customProgramCacheKey = () => "falls-triplanar-weathered-stone-v1";
  return material;
}

function fallingWaterMaterial(time: { value: number }) {
  const material = new T.MeshPhysicalMaterial({
    color: "#d8e1db",
    roughness: 0.24,
    metalness: 0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.18,
    transparent: true,
    opacity: 0.77,
    depthWrite: false,
    side: T.DoubleSide,
    alphaTest: 0.018,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fallsTime = time;
    shader.vertexShader = "varying vec2 fallsUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      fallsUv=uv;
    `,
    );
    shader.fragmentShader =
      "uniform float fallsTime; varying vec2 fallsUv;\n" +
      NOISE +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>
      float u=fract(fallsUv.x),v=fallsUv.y;
      // Square-root travel time makes details accelerate naturally down the fall.
      float travel=sqrt(v+.035)*17.-fallsTime*3.9;
      float braid=fallsNoise(vec2(fallsUv.x*29.+sin(v*13.)*.6,travel*.7));
      float fine=fallsNoise(vec2(fallsUv.x*97.,travel*2.8));
      float ribbon=fallsNoise(vec2(fallsUv.x*37.,v*3.2-fallsTime*.12));
      float aeration=smoothstep(.38,.83,braid*.58+fine*.42);
      float edge=smoothstep(.0,.12,u)*smoothstep(.0,.12,1.-u);
      float impactFade=1.-smoothstep(.94,1.,v);
      diffuseColor.rgb*=mix(vec3(.42,.55,.54),vec3(.97,1.,.97),.35+aeration*.65);
      diffuseColor.a*=edge*impactFade*(.28+aeration*.72)*smoothstep(.12,.43,ribbon);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
      vec3 fallingRipple=vec3(0.,sin(travel*1.9+fallsUv.x*21.)*.065,sin(fallsUv.x*132.-travel*.55)*.14);
      normal=normalize(normal+mat3(viewMatrix)*fallingRipple);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      float roughnessFactor=mix(.17,.48,aeration);
    `,
    );
  };
  material.customProgramCacheKey = () => "gravity-water-curtains-v1";
  return material;
}

function foamMaterial(time: { value: number }) {
  const material = new T.MeshStandardMaterial({
    color: "#b8c8bd",
    roughness: 0.9,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
    alphaTest: 0.015,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fallsTime = time;
    shader.vertexShader = "varying vec2 foamUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nfoamUv=uv;",
    );
    shader.fragmentShader =
      "uniform float fallsTime; varying vec2 foamUv;\n" +
      NOISE +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>
      vec2 p=(foamUv-.5)*vec2(10.,13.);
      float turbulent=fallsNoise(p*.8+vec2(fallsTime*.11,0.));
      vec2 current=p+vec2(fallsTime*.22,sin(p.x*.7-fallsTime*.35)*.3);
      float bubbles=fallsNoise(current*5.2);
      float eddies=fallsNoise(current*1.4+vec2(turbulent));
      float boundary=1.-smoothstep(1.7,5.1,length(p*vec2(1.,.7))+(turbulent-.5)*1.3);
      float core=1.-smoothstep(.3,2.,length(p-vec2(.4,0.)));
      diffuseColor.a*=boundary*(smoothstep(.43,.69,eddies)*smoothstep(.22,.6,bubbles)*.65+core*.3);
    `,
    );
  };
  material.customProgramCacheKey = () => "falls-foam-eddies-v1";
  return material;
}

function sprayMaterial(mist: boolean) {
  const material = new T.MeshStandardMaterial({
    color: mist ? "#ced8d1" : "#e1e6df",
    roughness: mist ? 1 : 0.35,
    transparent: true,
    opacity: mist ? 0.075 : 0.44,
    depthWrite: false,
    side: T.DoubleSide,
    alphaTest: 0.002,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 sprayUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nsprayUv=uv;",
    );
    shader.fragmentShader = "varying vec2 sprayUv;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>
      float softness=max(0.,1.-length((sprayUv-.5)*2.));
      diffuseColor.a*=pow(softness,${mist ? "2.4" : "1.3"});
    `,
    );
  };
  material.customProgramCacheKey = () =>
    mist ? "falls-soft-mist-v1" : "falls-droplets-v1";
  return material;
}

/** Five draw calls; the valley water's existing reflection captures this scenery. */
export function ScenicBackdrop({
  quality = "high",
  night = false,
}: {
  quality?: string;
  night?: boolean;
}) {
  const spray = useRef<T.InstancedMesh>(null),
    mist = useRef<T.InstancedMesh>(null);
  const resources = useMemo(() => {
    const time = { value: 0 };
    return {
      time,
      cliff: cliffGeometry(),
      curtains: curtainGeometry(),
      stone: cliffMaterial(),
      water: fallingWaterMaterial(time),
      foam: foamMaterial(time),
      spray: sprayMaterial(false),
      mist: sprayMaterial(true),
      quad: new T.PlaneGeometry(1, 1),
      foamQuad: new T.PlaneGeometry(10, 13),
      dummy: new T.Object3D(),
    };
  }, []);
  const mistCount = quality === "low" ? 12 : quality === "medium" ? 22 : 36;
  const sprayCount = quality === "low" ? 24 : quality === "medium" ? 48 : 80;
  useEffect(
    () => () => {
      resources.cliff.dispose();
      resources.curtains.dispose();
      resources.quad.dispose();
      resources.foamQuad.dispose();
      resources.stone.dispose();
      resources.water.dispose();
      resources.foam.dispose();
      resources.spray.dispose();
      resources.mist.dispose();
    },
    [resources],
  );
  useFrame(({ clock, camera }, dt) => {
    const time = clock.elapsedTime,
      dummy = resources.dummy;
    resources.time.value = time;
    // These remain lit PBR surfaces, not additive luminous effects at night.
    resources.mist.opacity = T.MathUtils.damp(
      resources.mist.opacity,
      night ? 0.055 : 0.075,
      1.2,
      dt,
    );
    const animate = (
      mesh: T.InstancedMesh | null,
      count: number,
      isMist: boolean,
    ) => {
      if (!mesh) return;
      for (let i = 0; i < count; i++) {
        const seed = random(i + 19),
          age = fract(time * (isMist ? 0.105 : 0.7) + seed);
        const z = (random(i + 3) - 0.5) * (isMist ? 8.5 : 7);
        if (isMist) {
          dummy.position.set(
            -5.4 - age * 3.1,
            0.3 + Math.sin(age * Math.PI) * 1.7,
            z + Math.sin(age * 4 + seed) * 0.6,
          );
          const scale =
            (0.65 + Math.sin(age * Math.PI) * 1.9) *
            (0.8 + random(i + 7) * 0.6);
          dummy.scale.set(scale, scale * 0.55, scale);
        } else {
          dummy.position.set(
            -5.6 - age * (1.1 + seed),
            0.16 + 2.9 * age * (1 - age),
            z,
          );
          const size =
            (0.018 + random(i + 11) * 0.032) * Math.sin(age * Math.PI);
          dummy.scale.set(size, size * 2.1, size);
        }
        dummy.quaternion.copy(camera.quaternion);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    animate(spray.current, sprayCount, false);
    animate(mist.current, mistCount, true);
  });
  return (
    <group name="valley-waterfall" position={ORIGIN} dispose={null}>
      <mesh
        name="waterfall-weathered-cliff"
        geometry={resources.cliff}
        material={resources.stone}
        castShadow
        receiveShadow
      />
      <mesh
        name="waterfall-curtains"
        geometry={resources.curtains}
        material={resources.water}
        receiveShadow
      />
      <mesh
        name="waterfall-foam"
        position={[-5, 0.09, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={resources.foam}
        geometry={resources.foamQuad}
        receiveShadow
      />
      <instancedMesh
        name="waterfall-spray"
        ref={spray}
        args={[resources.quad, resources.spray, sprayCount]}
        frustumCulled={false}
        receiveShadow
      />
      <instancedMesh
        name="waterfall-mist"
        ref={mist}
        args={[resources.quad, resources.mist, mistCount]}
        frustumCulled={false}
        receiveShadow
      />
    </group>
  );
}
