import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { rand } from "./content";
import { net } from "./network";

// One shader update moves every leaf, rather than rebuilding thousands of instance matrices.
export function WindMaterial({
  map,
  grass = false,
  phase = 0,
}: {
  map?: T.Texture;
  grass?: boolean;
  phase?: number;
}) {
  const material = useRef<T.MeshStandardMaterial>(null);
  const uniforms = useMemo(
    () => ({
      windTime: { value: 0 },
      season: { value: 0 },
      traveler: { value: new T.Vector2() },
    }),
    [],
  );
  useFrame(({ clock }, dt) => {
    uniforms.windTime.value = clock.elapsedTime;
    uniforms.season.value = T.MathUtils.damp(
      uniforms.season.value,
      Math.min(1, phase / 8),
      0.24,
      dt,
    );
    uniforms.traveler.value.set(net.local.x, net.local.z);
  });
  return (
    <meshStandardMaterial
      ref={material}
      map={map}
      alphaTest={map ? 0.4 : 0}
      side={T.DoubleSide}
      roughness={0.93}
      onBeforeCompile={(shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader =
          "uniform float windTime; uniform vec2 traveler; varying float leafLight;\n" +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
        vec3 root=vec3(0.);
        #ifdef USE_INSTANCING
        root=instanceMatrix[3].xyz;
        #endif
        float gust=sin(root.x*.12+root.z*.09-windTime*.8)+.4*sin(root.z*.31-windTime*1.7);
        float bend=${grass ? "max(0.,position.y+.5)" : "1."};
        transformed.x+=gust*${grass ? ".48" : ".18"}*bend;
        transformed.z+=sin(windTime*${grass ? "1.5" : "2.3"}+root.x*.28)*${grass ? ".23" : ".12"}*bend;
        transformed.y+=sin(windTime*3.4+root.z*.4+position.x*3.)*${grass ? ".03" : ".08"};
        ${grass ? "vec2 away=root.xz-traveler; float nearFoot=1.-smoothstep(.2,1.4,length(away)); transformed.xz+=normalize(away+vec2(.001))*nearFoot*.7*bend;" : ""}
        leafLight=.5+.5*sin(root.x*2.+root.z+position.y*2.+windTime*.3);`,
        );
        shader.fragmentShader =
          "uniform float season; varying float leafLight;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        diffuseColor.rgb*=mix(vec3(.84,1.,.84),vec3(1.1,.83,.59),season*.65);
        diffuseColor.rgb*=.89+leafLight*.22;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        totalEmissiveRadiance+=diffuseColor.rgb*${grass ? ".025" : ".09"}*(.45+leafLight*.55);`,
        );
      }}
      customProgramCacheKey={() => (grass ? "grass-wind-v2" : "leaf-wind-v2")}
    />
  );
}

export function Landscape() {
  const material = useMemo(() => {
    const m = new T.MeshStandardMaterial({ color: "#a8a17a", roughness: 0.97 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying vec3 landPos;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nlandPos=(modelMatrix*vec4(transformed,1.)).xyz;",
      );
      shader.fragmentShader =
        `varying vec3 landPos;
        float hashLand(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noiseLand(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hashLand(i),hashLand(i+vec2(1,0)),f.x),mix(hashLand(i+vec2(0,1)),hashLand(i+vec2(1,1)),f.x),f.y);}
        float pathLand(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
        ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 p=landPos.xz;
        float fine=noiseLand(p*34.);float grain=noiseLand(p*3.7);float broad=noiseLand(p*.13);
        float d=min(pathLand(p,vec2(0,-57),vec2(0,49)),min(pathLand(p,vec2(-33,-18),vec2(0,24)),pathLand(p,vec2(0,8),vec2(32,-28))));
        float edge=2.45+noiseLand(p*.75)*.8+sin(p.y*.4)*.15;
        float path=1.-smoothstep(edge-.5,edge+.5,d);
        vec3 grass=mix(vec3(.19,.26,.105),vec3(.38,.40,.19),broad);
        vec3 dirt=mix(vec3(.38,.29,.17),vec3(.55,.43,.28),grain*.5+.5);
        vec3 ground=mix(grass,dirt,path);
        vec2 cell=floor(p*5.);float pebble=step(.83,hashLand(cell))*smoothstep(.36,.18,length(fract(p*5.)-.5));
        ground+=pebble*.07+fine*.035;
        float leaf=step(.93,hashLand(floor(p*2.8)))*(1.-smoothstep(.14,.27,length(fract(p*2.8)-.5)));
        ground=mix(ground,vec3(.54,.22,.055),leaf*.65);
        diffuseColor.rgb=ground*(.85+grain*.23);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal=normalize(normal+vec3((noiseLand(landPos.xz*40.)-.5)*.13,0.,(noiseLand(landPos.xz*41.+3.)-.5)*.13));`,
      );
    };
    return m;
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  const mountains = useMemo(() => {
    const g = new T.PlaneGeometry(440, 440, 110, 110);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        r = Math.hypot(x, z);
      const edge = T.MathUtils.smoothstep(r, 90, 150);
      const h =
        edge *
        (12 +
          16 * Math.sin(x * 0.039) * Math.cos(z * 0.032) +
          12 * Math.sin(x * 0.067 + z * 0.021));
      p.setY(i, h - 1.5);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => mountains.dispose(), [mountains]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={material}>
        <planeGeometry args={[270, 270]} />
      </mesh>
      <mesh geometry={mountains} receiveShadow>
        <meshStandardMaterial color="#617365" roughness={1} />
      </mesh>
      <GroundScatter />
    </>
  );
}
function GroundScatter() {
  const ref = useRef<T.InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const o = new T.Object3D(),
      c = new T.Color();
    for (let i = 0; i < 950; i++) {
      const a = rand(i + 710) * 6.28,
        r = 9 + Math.sqrt(rand(i + 420)) * 75;
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      o.position.set(x, 0.025, z);
      o.rotation.set(rand(i) * 0.3, rand(i + 99) * 6.28, rand(i + 12) * 0.3);
      const scale = 0.025 + rand(i + 52) * 0.15;
      o.scale.set(scale * 1.5, scale * 0.55, scale);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
      ref.current.setColorAt(
        i,
        c.set(["#8d8878", "#77796b", "#a09375"][i % 3]),
      );
    }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 950]} receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.96} />
    </instancedMesh>
  );
}
