import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import {
  rand,
  stations,
  props,
  obstacles,
  tables,
  towers,
  lanternStands,
  riverStops,
} from "./content";
import { instanceBarkUV, pbrTextures, textureAsset } from "./materials";
import { riverGroundHeight } from "./RiverTerrain";

type Triple = [number, number, number];
type Instance = {
  p: Triple;
  q: [number, number, number, number];
  s: Triple;
  c: string;
};
type FloorLayout = {
  ferns: Instance[];
  caps: Instance[];
  stems: Instance[];
  wood: Instance[];
  ends: Instance[];
};
const targets = [
  ...Object.values(stations),
  ...props,
  ...tables,
  ...towers,
  ...lanternStands,
];
const wildlifeClearings = [
  [-45, -8],
  [-49, -13],
  [-18, 8],
  [-20, 11],
  [-15, 11],
];
const trails = [
  [0, -57, 0, 49],
  [-33, -18, 0, 24],
  [0, 8, 32, -28],
];
function trailDistance(x: number, z: number, [ax, az, bx, bz]: number[]) {
  const dx = bx - ax,
    dz = bz - az;
  const t = T.MathUtils.clamp(
    ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz),
    0,
    1,
  );
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}
function clearGround(x: number, z: number, margin = 0) {
  return (
    x < -12 &&
    z > -43 &&
    z < 11 &&
    trails.every((line) => trailDistance(x, z, line) > 4.15 + margin) &&
    wildlifeClearings.every(
      ([cx, cz]) => Math.hypot(x - cx, z - cz) > 5 + margin,
    ) &&
    targets.every((p) => Math.hypot(x - p.x, z - p.z) > 2.15 + margin) &&
    obstacles.every(
      (b) =>
        Math.abs(x - b.x) > b.w + 1.3 + margin ||
        Math.abs(z - b.z) > b.d + 1.3 + margin,
    )
  );
}
function placement(
  p: Triple,
  s: Triple,
  rotation: Triple,
  c: string,
): Instance {
  return {
    p,
    s,
    q: new T.Quaternion().setFromEuler(new T.Euler(...rotation)).toArray(),
    c,
  };
}

/** Deterministic scenic detail. Clearances also keep decorations distinct from collectible props. */
export function forestFloorLayout(river = false, section = 0): FloorLayout {
  const data: FloorLayout = {
    ferns: [],
    caps: [],
    stems: [],
    wood: [],
    ends: [],
  };
  const safe = (x: number, z: number, margin = 0) =>
    river
      ? Math.abs(x) > 18.8 + margin &&
        riverStops.every((stop) => Math.abs(z + stop) > 14 + margin)
      : clearGround(x, z, margin);
  const groundHeight = (x: number, z: number) =>
    river ? riverGroundHeight(x, z) : 0;
  const clusters: { x: number; z: number; seed: number }[] = [];
  // Stable world tiles retain identical plants across section boundaries. Newly
  // loaded/unloaded tiles are more than a hundred metres from the boat.
  for (let tileIndex = 0; tileIndex < (river ? 4 : 1); tileIndex++) {
    const tile = river ? section - 1 + tileIndex : 0;
    const tileClusters: typeof clusters = [];
    for (let i = 0; i < 210 && tileClusters.length < (river ? 8 : 44); i++) {
      const seed = i + 6140 + tile * 1776;
      const x = river
        ? (i % 2 ? -1 : 1) * (20.5 + rand(seed) * 16)
        : -15 - rand(seed) * 35;
      const z = river
        ? 25 - tile * 100 - rand(seed + 13) * 100
        : -39 + rand(seed + 13) * 46;
      if (
        safe(x, z, 1.5) &&
        tileClusters.every((p) => Math.hypot(x - p.x, z - p.z) > 2.9)
      )
        tileClusters.push({ x, z, seed });
    }
    clusters.push(...tileClusters);
  }
  const woodPiece = (
    x: number,
    z: number,
    radius: number,
    length: number,
    yaw: number,
    upright = false,
  ) => {
    const h = groundHeight(x, z) + (upright ? length / 2 : radius * 0.78);
    const item = placement(
      [x, h, z],
      [radius, length, radius],
      upright ? [0, yaw, 0] : [0, yaw, Math.PI / 2],
      "#c0b9a5",
    );
    if (river && !upright) {
      const dx = -Math.cos(yaw),
        dz = Math.sin(yaw);
      const dy =
        (groundHeight(x + (dx * length) / 2, z + (dz * length) / 2) -
          groundHeight(x - (dx * length) / 2, z - (dz * length) / 2)) /
        length;
      item.q = new T.Quaternion()
        .setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          new T.Vector3(dx, dy, dz).normalize(),
        )
        .toArray();
    }
    data.wood.push(item);
    const q = new T.Quaternion().fromArray(item.q);
    for (const side of [-1, 1]) {
      const end = new T.Vector3(0, side * length * 0.501, 0)
        .applyQuaternion(q)
        .add(new T.Vector3(...item.p));
      const orient = q
        .clone()
        .multiply(
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(1, 0, 0),
            (-side * Math.PI) / 2,
          ),
        );
      data.ends.push({
        p: end.toArray(),
        q: orient.toArray(),
        s: [radius * (side > 0 ? 0.79 : 1), radius * (side > 0 ? 0.79 : 1), 1],
        c: "#a08b68",
      });
    }
  };
  clusters.forEach(({ x, z, seed }, clusterIndex) => {
    const cluster = river ? Math.floor(rand(seed + 891) * 10000) : clusterIndex;
    const plants = 2 + Math.floor(rand(seed + 14) * 3);
    for (let p = 0; p < plants; p++) {
      const a = rand(seed + p * 17) * Math.PI * 2,
        radius = rand(seed + p * 23) * 1.2;
      const px = x + Math.cos(a) * radius,
        pz = z + Math.sin(a) * radius;
      if (!safe(px, pz, 0.65)) continue;
      const plantSize = 0.55 + rand(seed + p * 43) * 0.6;
      const fronds = 5 + (p % 2);
      for (let f = 0; f < fronds; f++) {
        const yaw = (f / fronds) * Math.PI * 2 + a;
        const scale = plantSize * (0.76 + rand(seed + p * 71 + f) * 0.37);
        data.ferns.push(
          placement(
            [px, groundHeight(px, pz) + 0.015, pz],
            [scale, scale * (0.8 + rand(seed + f) * 0.3), scale],
            [0, yaw, 0],
            ["#e4e1ce", "#d9dfc7", "#e5ddc6", "#cbd4b7"][cluster % 4],
          ),
        );
      }
    }
    if (cluster % 3 === 0) {
      const count = 3 + (cluster % 4);
      for (let m = 0; m < count; m++) {
        const a = rand(seed + m * 9 + 45) * Math.PI * 2,
          r = 0.12 + rand(seed + m * 13 + 61) * 0.35;
        const mx = x + Math.cos(a) * r,
          mz = z + Math.sin(a) * r;
        const cap = 0.046 + rand(seed + m * 11) * 0.058,
          stem = 0.05 + rand(seed + m * 31) * 0.09;
        const tilt: Triple = [
          (rand(seed + m * 7) - 0.5) * 0.15,
          a,
          (rand(seed + m * 17) - 0.5) * 0.15,
        ];
        data.caps.push(
          placement(
            [mx, groundHeight(mx, mz) + stem, mz],
            [cap, cap * 0.65, cap],
            tilt,
            ["#97765b", "#b09472", "#87654b"][Math.floor(cluster / 3) % 3],
          ),
        );
        data.stems.push(
          placement(
            [mx, groundHeight(mx, mz) + stem / 2, mz],
            [cap, stem, cap],
            tilt,
            "#c3b9a0",
          ),
        );
      }
    }
    if (cluster % 4 === 1 && safe(x, z, 1.4))
      woodPiece(
        x,
        z,
        0.055 + rand(seed + 31) * 0.025,
        1.3 + rand(seed + 82) * 1.1,
        rand(seed + 71) * Math.PI * 2,
      );
    for (let b = 0; b < (cluster % 2 ? 2 : 1); b++) {
      const bx = x + rand(seed + b + 300) - 0.5,
        bz = z + rand(seed + b + 410) - 0.5;
      woodPiece(
        bx,
        bz,
        0.009 + rand(seed + b + 17) * 0.008,
        0.34 + rand(seed + b + 97) * 0.58,
        rand(seed + b + 73) * Math.PI * 2,
      );
    }
  });
  // Short weathered stumps stay at the far woodland edge, beyond walking routes.
  if (!river) {
    const stumpSites: [number, number][] = [];
    for (let i = 0; i < 40 && stumpSites.length < 3; i++) {
      const x = -44 - rand(i + 7311) * 6,
        z = -25 - rand(i + 8199) * 15;
      if (
        safe(x, z, 0.8) &&
        stumpSites.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 4)
      ) {
        stumpSites.push([x, z]);
        woodPiece(
          x,
          z,
          0.15 + rand(i + 97) * 0.055,
          0.23 + rand(i + 44) * 0.06,
          rand(i + 18) * 6,
          true,
        );
      }
    }
  }
  return data;
}

let fernTexture: T.Texture | undefined;
function fernMap() {
  if (!fernTexture) {
    fernTexture = new T.TextureLoader().load("/textures/woodland-fern.webp");
    fernTexture.colorSpace = T.SRGBColorSpace;
    fernTexture.anisotropy = 4;
  }
  return fernTexture;
}
function fernGeometry() {
  const geometry = new T.PlaneGeometry(0.56, 1, 1, 8),
    p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5;
    p.setXYZ(
      i,
      p.getX(i),
      Math.sin(t * Math.PI * 0.87) * 0.47 + t * 0.018,
      t * 0.87,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}
const noiseGLSL = `float floorHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float floorNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(floorHash(i),floorHash(i+vec2(1.,0.)),f.x),mix(floorHash(i+vec2(0.,1.)),floorHash(i+vec2(1.)),f.x),f.y);}
`;
function fillInstances(mesh: T.InstancedMesh | null, items: Instance[]) {
  if (!mesh) return;
  const matrix = new T.Matrix4(),
    position = new T.Vector3(),
    scale = new T.Vector3(),
    rotation = new T.Quaternion(),
    color = new T.Color();
  items.forEach((item, i) => {
    matrix.compose(
      position.fromArray(item.p),
      rotation.fromArray(item.q),
      scale.fromArray(item.s),
    );
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.set(item.c));
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Five instanced draws, with only one wind uniform changed each frame. */
export function ForestFloor({
  river = false,
  progress = 0,
}: {
  river?: boolean;
  progress?: number;
}) {
  const section = river ? Math.floor(progress / 100) : 0;
  const data = useMemo(
    () => forestFloorLayout(river, section),
    [river, section],
  );
  const fern = useRef<T.InstancedMesh>(null),
    cap = useRef<T.InstancedMesh>(null),
    stem = useRef<T.InstancedMesh>(null),
    wood = useRef<T.InstancedMesh>(null),
    end = useRef<T.InstancedMesh>(null);
  const assets = useMemo(() => {
    const wind = { value: 0 };
    const ferns = new T.MeshStandardMaterial({
      map: fernMap(),
      alphaTest: 0.46,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 0.96,
    });
    ferns.onBeforeCompile = (shader) => {
      shader.uniforms.floorWind = wind;
      shader.vertexShader = "uniform float floorWind;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 root=vec3(0.);
        #ifdef USE_INSTANCING
          root=instanceMatrix[3].xyz;
        #endif
        float tip=uv.y*uv.y;
        transformed.x+=sin(floorWind*1.1+root.x*.8+root.z*.6)*tip*.026;
        transformed.y+=sin(floorWind*.9+root.z*.5)*tip*.018;`,
      );
    };
    ferns.customProgramCacheKey = () => "forest-floor-fern-v1";
    const bark = new T.MeshStandardMaterial({
      ...pbrTextures("bark"),
      roughness: 1,
      normalScale: new T.Vector2(0.55, 0.55),
    });
    bark.onBeforeCompile = (shader) => {
      instanceBarkUV(shader);
      shader.uniforms.floorMoss = { value: textureAsset("ground", "color") };
      shader.vertexShader =
        "varying vec3 floorPos; varying vec3 floorNormal;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vec4 fp=vec4(transformed,1.);vec3 fn=normal;
        #ifdef USE_INSTANCING
          fp=instanceMatrix*fp;fn=mat3(instanceMatrix)*fn;
        #endif
        floorPos=(modelMatrix*fp).xyz;floorNormal=normalize(mat3(modelMatrix)*fn);`,
      );
      shader.fragmentShader =
        "varying vec3 floorPos; varying vec3 floorNormal; uniform sampler2D floorMoss;\n" +
        noiseGLSL +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float moss=smoothstep(.2,.78,floorNormal.y)*smoothstep(.36,.68,floorNoise(floorPos.xz*8.));
        vec3 mossColor=texture2D(floorMoss,floorPos.xz*2.6).rgb*vec3(.56,.73,.35);
        diffuseColor.rgb=mix(diffuseColor.rgb,mossColor,moss*.83);`,
      );
    };
    bark.customProgramCacheKey = () => "forest-floor-moss-bark-v1";
    const ends = new T.MeshStandardMaterial({
      ...pbrTextures("wood"),
      roughness: 1,
      normalScale: new T.Vector2(0.2, 0.2),
    });
    ends.onBeforeCompile = (shader) => {
      shader.fragmentShader = noiseGLSL + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec2 grainUv=vMapUv-.5;
        float grainR=length(grainUv+vec2(.018*sin(grainUv.y*17.),.015*cos(grainUv.x*19.)));
        float ring=.5+.5*sin(grainR*160.+floorNoise(grainUv*13.)*3.);
        diffuseColor.rgb*=.79+.21*smoothstep(.18,.8,ring);`,
      );
    };
    ends.customProgramCacheKey = () => "forest-floor-cut-grain-v1";
    const caps = new T.MeshStandardMaterial({ roughness: 0.77 });
    caps.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying vec3 capPos;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ncapPos=position;",
      );
      shader.fragmentShader =
        "varying vec3 capPos;\n" + noiseGLSL + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float fleck=floorNoise(capPos.xz*38.);
        diffuseColor.rgb*=.85+.2*fleck;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.54,.46,.34),1.-smoothstep(.01,.15,capPos.y));`,
      );
    };
    caps.customProgramCacheKey = () => "forest-floor-mushroom-v1";
    const stems = new T.MeshStandardMaterial({ roughness: 1 });
    const capGeo = new T.LatheGeometry(
      [
        new T.Vector2(0, -0.04),
        new T.Vector2(0.63, -0.04),
        new T.Vector2(0.97, 0),
        new T.Vector2(1, 0.12),
        new T.Vector2(0.87, 0.4),
        new T.Vector2(0.54, 0.66),
        new T.Vector2(0, 0.77),
      ],
      10,
    );
    return {
      wind,
      ferns,
      bark,
      ends,
      caps,
      stems,
      fernGeo: fernGeometry(),
      capGeo,
      stemGeo: new T.CylinderGeometry(0.1, 0.14, 1, 7, 1),
      woodGeo: new T.CylinderGeometry(0.79, 1, 1, 9, 1, true),
      endGeo: new T.CircleGeometry(1, 9),
    };
  }, []);
  useFrame(({ clock }) => {
    assets.wind.value = clock.elapsedTime;
  });
  useLayoutEffect(() => {
    fillInstances(fern.current, data.ferns);
    fillInstances(cap.current, data.caps);
    fillInstances(stem.current, data.stems);
    fillInstances(wood.current, data.wood);
    fillInstances(end.current, data.ends);
  }, [data]);
  useEffect(
    () => () => {
      [
        assets.ferns,
        assets.bark,
        assets.ends,
        assets.caps,
        assets.stems,
        assets.fernGeo,
        assets.capGeo,
        assets.stemGeo,
        assets.woodGeo,
        assets.endGeo,
      ].forEach((asset) => asset.dispose());
    },
    [assets],
  );
  return (
    <group name="woodland-understory" dispose={null}>
      <instancedMesh
        ref={fern}
        args={[assets.fernGeo, assets.ferns, 1100]}
        receiveShadow
      />
      <instancedMesh
        ref={cap}
        args={[assets.capGeo, assets.caps, 110]}
        receiveShadow
      />
      <instancedMesh
        ref={stem}
        args={[assets.stemGeo, assets.stems, 110]}
        receiveShadow
      />
      <instancedMesh
        ref={wood}
        args={[assets.woodGeo, assets.bark, 100]}
        receiveShadow
      />
      <instancedMesh
        ref={end}
        args={[assets.endGeo, assets.ends, 200]}
        receiveShadow
      />
    </group>
  );
}
