import * as THREE from "three";

const SEGMENTS = 5;
const grooms = new WeakMap<
  THREE.BufferGeometry,
  Map<string, THREE.InstancedBufferGeometry>
>();

/** Fine undercoat / nose relief, filtered away when smaller than a pixel. */
export function addSurfaceDetail(
  material: THREE.MeshStandardMaterial,
  mesh: THREE.Mesh,
  nose = false,
) {
  mesh.updateMatrix();
  const transform = { value: mesh.matrix.clone() };
  material.customProgramCacheKey = () =>
    nose ? "mingy-nose-v3" : "mingy-undercoat-v3";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.coatTransform = transform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform mat4 coatTransform; varying vec3 vCoatP;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvCoatP = (coatTransform * vec4(position, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vCoatP;
        float detailHash(vec3 p) {
          p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float detailNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(detailHash(i), detailHash(i+vec3(1,0,0)),f.x),
            mix(detailHash(i+vec3(0,1,0)),detailHash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(detailHash(i+vec3(0,0,1)),detailHash(i+vec3(1,0,1)),f.x),
            mix(detailHash(i+vec3(0,1,1)),detailHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 cp = vCoatP * ${nose ? "430.0" : "950.0"};
        float filterWidth = max(length(dFdx(cp)), length(dFdy(cp)));
        float grainFade = 1.0 - smoothstep(0.5, 2.3, filterWidth);
        float grain = detailNoise(cp) * 2.0 - 1.0;
        float height = grain * grainFade * ${nose ? "0.00035" : "0.00018"};
        vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
        vec3 rx = cross(sy, normal), ry = cross(normal, sx);
        float det = dot(sx, rx);
        if (abs(det) > 1e-12) normal = normalize(abs(det) * normal - sign(det) * (dFdx(height) * rx + dFdy(height) * ry));
        diffuseColor.rgb *= 1.0 - (0.5 + 0.5 * grain) * grainFade * ${nose ? "0.025" : "0.08"};
      `,
      );
  };
}

/** Lengths use puppy space, independent of the sculpt's ellipsoid scales. */
function profile(mesh: THREE.Mesh, p: THREE.Vector3, n: THREE.Vector3) {
  const parent = mesh.parent?.name || "";
  if (parent.startsWith("Ear"))
    return {
      length: 0.035 + Math.max(0, -p.y) * 0.085,
      flow: new THREE.Vector3(0, -1, -0.12),
    };
  if (parent === "Tail")
    return {
      length: n.y < 0 ? 0.1 : 0.042,
      flow: new THREE.Vector3(0, -0.6, -1),
    };
  if (/^(Front|Back)/.test(parent))
    return {
      length: p.y < -0.36 ? 0.012 : 0.033,
      flow: new THREE.Vector3(0, -1, -0.22),
    };
  if (parent === "Head" || parent === "Jaw") {
    // Keep eyes, lip line and nose clear; feather the cheeks and crown.
    const muzzle = p.z > 0.29 && p.y < 0.2;
    const eye = p.z > 0.15 && p.y > 0.18 && p.y < 0.32 && Math.abs(p.x) > 0.1;
    return {
      length:
        parent === "Jaw"
          ? 0.006
          : muzzle
            ? 0.004
            : eye
              ? 0.004
              : p.y < 0.13
                ? 0.042
                : 0.038,
      flow: new THREE.Vector3(p.x * 2.5, p.y > 0.26 ? 0.25 : -0.6, -0.65),
    };
  }
  return {
    length: n.y > 0.45 ? 0.048 : 0.065,
    flow: new THREE.Vector3(n.x * 0.16, -0.65, -0.85),
  };
}

/** Area-weighted follicles with a dense undercoat and longer guard hairs. */
function groomGeometry(mesh: THREE.Mesh) {
  mesh.updateMatrix();
  const key = `${mesh.parent?.name}:${mesh.name}:${mesh.matrix.elements.join(",")}`;
  const variants =
    grooms.get(mesh.geometry) ||
    new Map<string, THREE.InstancedBufferGeometry>();
  const cached = variants.get(key);
  if (cached) return cached.clone();
  const surface = mesh.geometry.clone().applyMatrix4(mesh.matrix);
  const positions = surface.getAttribute("position"),
    normals = surface.getAttribute("normal"),
    colors = surface.getAttribute("color"),
    index = surface.index;
  const triangles = (index?.count || positions.count) / 3;
  const areas = new Float64Array(triangles);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const ab = new THREE.Vector3(),
    ac = new THREE.Vector3();
  let area = 0;
  for (let i = 0; i < triangles; i++) {
    a.fromBufferAttribute(positions, index ? index.getX(i * 3) : i * 3);
    b.fromBufferAttribute(positions, index ? index.getX(i * 3 + 1) : i * 3 + 1);
    c.fromBufferAttribute(positions, index ? index.getX(i * 3 + 2) : i * 3 + 2);
    area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
    areas[i] = area;
  }
  const count = Math.max(80, Math.min(24000, Math.round(area * 14500)));
  const roots = new Float32Array(count * 3),
    ns = new Float32Array(count * 3),
    flows = new Float32Array(count * 3),
    pigments = new Float32Array(count * 3),
    traits = new Float32Array(count * 4);
  let seed = 7919;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const p = new THREE.Vector3(),
    n = new THREE.Vector3(),
    pigment = new THREE.Vector3(),
    nb = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const pick = random() * area;
    let lo = 0,
      hi = triangles - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (areas[mid] < pick) lo = mid + 1;
      else hi = mid;
    }
    const ids = [0, 1, 2].map((k) =>
      index ? index.getX(lo * 3 + k) : lo * 3 + k,
    );
    const u = Math.sqrt(random()),
      v = random(),
      weights = [1 - u, u * (1 - v), u * v];
    p.set(0, 0, 0);
    n.set(0, 0, 0);
    pigment.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      p.addScaledVector(a.fromBufferAttribute(positions, ids[k]), weights[k]);
      n.addScaledVector(nb.fromBufferAttribute(normals, ids[k]), weights[k]);
      if (colors)
        pigment.addScaledVector(
          nb.fromBufferAttribute(colors, ids[k]),
          weights[k],
        );
    }
    if (!colors) pigment.set(1, 1, 1);
    n.normalize();
    const { length, flow } = profile(mesh, p, n);
    flow.addScaledVector(n, -flow.dot(n));
    if (flow.lengthSq() < 0.001)
      flow.set(0.6, 0, -0.4).addScaledVector(n, -n.x * 0.6 + n.z * 0.4);
    flow.normalize();
    const guard = random() > 0.83;
    p.toArray(roots, i * 3);
    n.toArray(ns, i * 3);
    flow.toArray(flows, i * 3);
    pigment.toArray(pigments, i * 3);
    traits.set(
      [
        length * (guard ? 1.15 + random() * 0.3 : 0.52 + random() * 0.48),
        (guard ? 0.00075 : 0.0012) * (0.75 + random() * 0.5),
        random(),
        guard ? 1 : 0,
      ],
      i * 4,
    );
  }
  const geometry = new THREE.InstancedBufferGeometry();
  const vertices: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    for (const side of [-1, 1]) {
      vertices.push(side, i / SEGMENTS, 0);
      uv.push((side + 1) / 2, i / SEGMENTS);
    }
    if (i < SEGMENTS) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      vertices.map((_, i) => (i % 3 === 2 ? 1 : 0)),
      3,
    ),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute(
    "furRoot",
    new THREE.InstancedBufferAttribute(roots, 3),
  );
  geometry.setAttribute("furNormal", new THREE.InstancedBufferAttribute(ns, 3));
  geometry.setAttribute(
    "furPigment",
    new THREE.InstancedBufferAttribute(pigments, 3),
  );
  geometry.setAttribute(
    "furFlow",
    new THREE.InstancedBufferAttribute(flows, 3),
  );
  geometry.setAttribute(
    "furTraits",
    new THREE.InstancedBufferAttribute(traits, 4),
  );
  geometry.instanceCount = count;
  surface.computeBoundingBox();
  geometry.boundingBox = surface.boundingBox!.clone().expandByScalar(0.16);
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(
    new THREE.Sphere(),
  );
  surface.dispose();
  variants.set(key, geometry);
  grooms.set(mesh.geometry, variants);
  return geometry.clone();
}

const vertexCommon = /* glsl */ `
attribute vec3 furRoot;
attribute vec3 furNormal;
attribute vec3 furFlow;
attribute vec3 furPigment;
attribute vec4 furTraits;
uniform vec3 furBend;
uniform float furWidth;
varying vec3 vFiberTangent;
varying vec3 vFiberNormal;
varying vec3 vFiberTraits;
varying vec2 vFiberUV;
varying vec3 vFiberPigment;
`;

// Fiber-oriented reflection lobes inspired by Kajiya–Kay. This is a real-time
// approximation, not the full Marschner multiple-scattering/path-traced model:
// https://www.cs.cornell.edu/~srm/publications/SG03-hair-abstract.html
const fiberLighting = /* glsl */ `
void RE_Direct_Fiber(const in IncidentLight directLight, const in vec3 geometryPosition,
  const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal,
  const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  vec3 T = normalize(vFiberTangent);
  vec3 N = normalize(vFiberNormal);
  vec3 L = directLight.direction;
  vec3 V = geometryViewDir;
  vec3 H = normalize(L + V);
  float fiberNL = sqrt(max(0.0, 1.0 - pow(dot(T, L), 2.0)));
  float skinNL = dot(N, L);
  float visibility = mix(0.2, 1.0, smoothstep(-0.18, 0.6, skinNL));
  float primary = pow(sqrt(max(0.0, 1.0 - pow(dot(normalize(T + N * 0.08), H), 2.0))), 72.0);
  float secondary = pow(sqrt(max(0.0, 1.0 - pow(dot(normalize(T - N * 0.12), H), 2.0))), 24.0);
  float fresnel = 0.0465 + 0.9535 * pow(1.0 - max(0.0, dot(V, H)), 5.0);
  float rootOcclusion = mix(0.75, 1.0, smoothstep(0.0, 0.8, vFiberUV.y));
  vec3 pigment = material.diffuseContribution;
  reflectedLight.directDiffuse += directLight.color * pigment * RECIPROCAL_PI * fiberNL * visibility * rootOcclusion * (1.0 - fresnel);
  reflectedLight.directSpecular += directLight.color * fiberNL * visibility * rootOcclusion *
    (vec3(primary * fresnel * 1.25) + pigment * secondary * 0.035);
  // Transmission through thin tips is strongest on the backlit silhouette.
  float through = pow(max(0.0, dot(-L, V)), 5.0) * max(0.0, -skinNL);
  reflectedLight.directDiffuse += directLight.color * sqrt(pigment) * through * 0.18 * vFiberUV.y * rootOcclusion;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Fiber
`;

export function addFur(mesh: THREE.Mesh) {
  const base = mesh.material as THREE.MeshStandardMaterial;
  const geometry = groomGeometry(mesh),
    fullCount = geometry.instanceCount;
  const bend = { value: new THREE.Vector3() },
    width = { value: 1 };
  const material = new THREE.MeshPhysicalMaterial({
    color: base.color,
    roughness: 0.62,
    metalness: 0,
    ior: 1.55,
    sheen: 0.08,
    sheenColor: base.color,
    sheenRoughness: 0.65,
    side: THREE.DoubleSide,
    alphaTest: 0.12,
    transparent: true,
    alphaToCoverage: false,
  });
  material.customProgramCacheKey = () => "mingy-fiber-groom-v4";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { furBend: bend, furWidth: width });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${vertexCommon}`)
      .replace(
        "#include <beginnormal_vertex>",
        "vec3 objectNormal = furNormal;",
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        float t = position.y;
        float len = furTraits.x;
        vec3 N = normalize(furNormal);
        vec3 G = normalize(furFlow);
        vec3 sideways = normalize(cross(N, G));
        // Fixed roots; curved tips flex under inertial load.
        // Nearby fibers share a soft wave, with small strand-level variation.
        float phase = sin(dot(furRoot, vec3(85.0, 37.0, 63.0))) * 1.6 + furTraits.z * 0.6;
        float curl = sin(t * 5.0 + phase) - sin(phase);
        vec3 sway = furBend + vec3(0.0, -0.1, 0.0);
        vec3 center = furRoot + len * (N * (t - 0.35*t*t) + G * 0.75*t*t +
          sideways * curl * t * 0.065 + sway * t*t);
        vec3 tangent = normalize(N * (1.0 - 0.7*t) + G * 1.5*t +
          sideways * (curl + 5.0*t*cos(t*5.0 + phase)) * 0.065 + sway * 2.0*t);
        vec3 viewT = normalize(mat3(modelViewMatrix) * tangent);
        vec3 viewCenter = (modelViewMatrix * vec4(center, 1.0)).xyz;
        vec3 viewSide = cross(normalize(-viewCenter), viewT);
        if (dot(viewSide, viewSide) < 0.001) viewSide = cross(vec3(0.0, 1.0, 0.0), viewT);
        vec3 ribbonSide = normalize(transpose(mat3(modelViewMatrix)) * normalize(viewSide));
        float taper = mix(1.0, 0.045, pow(t, 1.45));
        vec3 transformed = center + ribbonSide * position.x * furTraits.y * taper * furWidth;
        vFiberTangent = viewT;
        vFiberNormal = normalize(normalMatrix * N);
        vFiberTraits = furTraits.yzw;
        vFiberUV = uv;
        vFiberPigment = furPigment;
      `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vFiberTangent; varying vec3 vFiberNormal;
        varying vec3 vFiberTraits; varying vec2 vFiberUV; varying vec3 vFiberPigment;`,
      )
      .replace(
        "#include <lights_physical_pars_fragment>",
        `#include <lights_physical_pars_fragment>\n${fiberLighting}`,
      )
      .replace(
        "#include <alphatest_fragment>",
        /* glsl */ `
        float edge = abs(vFiberUV.x * 2.0 - 1.0);
        float aa = max(fwidth(edge), 0.08);
        diffuseColor.a *= 1.0 - smoothstep(1.0 - aa, 1.0, edge);
        diffuseColor.rgb *= vFiberPigment * mix(0.9, 1.08, vFiberTraits.y) * mix(0.92, 1.04, vFiberUV.y);
        #include <alphatest_fragment>
      `,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `
        #include <normal_fragment_maps>
        normal = normalize(vFiberNormal);
      `,
      );
  };
  const fur = new THREE.Mesh(geometry, material);
  fur.name = `Silken strands · ${mesh.name}`;
  fur.receiveShadow = true;
  // Screen-space AO mistakes the subpixel groom for coarse surface cavities.
  // Use the groom's root occlusion and the sculpt's real light shadows instead.
  mesh.userData.cannotReceiveAO = true;
  fur.userData.cannotReceiveAO = true;
  fur.userData.treatAsOpaque = true;
  // Depth-writing cores keep the groom stable; blended edges remain smooth in
  // both multisampled and performance-mode postprocessing targets.
  mesh.parent!.add(fur);
  const center = geometry.boundingSphere!.center;
  const previous = new THREE.Vector3(),
    current = new THREE.Vector3();
  const velocity = new THREE.Vector3(),
    lastVelocity = new THREE.Vector3();
  const force = new THREE.Vector3(),
    springVelocity = new THREE.Vector3();
  const inverseRotation = new THREE.Quaternion();
  let initialized = false;
  return {
    dispose() {
      geometry.dispose();
      material.dispose();
      fur.removeFromParent();
    },
    update(dt: number, camera: THREE.Camera) {
      current.copy(center).applyMatrix4(fur.matrixWorld);
      if (!initialized || dt > 0.1) {
        previous.copy(current);
        lastVelocity.set(0, 0, 0);
        initialized = true;
      }
      const step = Math.max(0.001, Math.min(dt, 0.05));
      velocity.subVectors(current, previous).divideScalar(step);
      force
        .subVectors(velocity, lastVelocity)
        .multiplyScalar(-0.007)
        .addScaledVector(velocity, -0.035)
        .clampLength(0, 0.55);
      fur.getWorldQuaternion(inverseRotation).invert();
      force.applyQuaternion(inverseRotation);
      // A damped spring with substeps remains stable after a slow frame.
      const steps = Math.ceil(step * 120),
        h = step / steps;
      for (let i = 0; i < steps; i++) {
        springVelocity
          .addScaledVector(force, 90 * h)
          .addScaledVector(bend.value, -90 * h)
          .multiplyScalar(Math.exp(-17 * h));
        bend.value.addScaledVector(springVelocity, h);
      }
      previous.copy(current);
      lastVelocity.copy(velocity);
      const distance =
        camera.position.distanceTo(current) /
        fur.matrixWorld.getMaxScaleOnAxis();
      // Continuous density avoids visible steps; deterministic prefixes preserve
      // an even groom. Faraway hairs are subpixel and need less geometry.
      const fraction = THREE.MathUtils.lerp(
        1,
        0.16,
        THREE.MathUtils.smoothstep(distance, 3, 16),
      );
      geometry.instanceCount = Math.ceil(fullCount * fraction);
      width.value = Math.min(1.65, 1 / Math.sqrt(fraction));
    },
  };
}
