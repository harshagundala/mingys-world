import * as THREE from "three";
const shellGeometry = new WeakMap<
  THREE.BufferGeometry,
  THREE.InstancedBufferGeometry
>();
/** Seven instanced, tapered coat layers. The skin supplies shadowing; the groom supplies silhouette. */
export function addFur(mesh: THREE.Mesh) {
  const base = mesh.material as THREE.MeshStandardMaterial;
  let geometry = shellGeometry.get(mesh.geometry);
  if (!geometry) {
    geometry = new THREE.InstancedBufferGeometry();
    geometry.index = mesh.geometry.index;
    for (const [key, value] of Object.entries(mesh.geometry.attributes))
      geometry.setAttribute(key, value);
    geometry.setAttribute(
      "furLayer",
      new THREE.InstancedBufferAttribute(
        new Float32Array([0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1]),
        1,
      ),
    );
    geometry.instanceCount = 7;
    shellGeometry.set(mesh.geometry, geometry);
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: base.color,
    roughness: 1,
    sheen: 1,
    sheenColor: new THREE.Color("#ffdbaa"),
    sheenRoughness: 0.8,
    side: THREE.FrontSide,
  });
  material.customProgramCacheKey = () => "mingy-groom-v2";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float furLayer; varying float vFurLayer; varying vec3 vCoatPosition;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vFurLayer=furLayer;vCoatPosition=position;
vec3 groom=normalize(normal+vec3(0.0,-0.24,-0.1));
transformed += groom*(0.022*furLayer);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vFurLayer; varying vec3 vCoatPosition;
float coatHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}`,
      )
      .replace(
        "#include <alphatest_fragment>",
        `#include <alphatest_fragment>
vec3 cell=floor(vCoatPosition*430.0);
float strand=coatHash(cell);
if(strand < 0.25+vFurLayer*0.66) discard;
diffuseColor.rgb *= mix(0.96,1.08,vFurLayer);`,
      );
  };
  const shell = new THREE.Mesh(geometry, material);
  shell.name = "Groomed fur shells";
  shell.frustumCulled = false;
  shell.receiveShadow = true;
  mesh.add(shell);
  return material;
}
