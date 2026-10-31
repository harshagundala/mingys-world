import { useEffect, useMemo } from "react";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Piece = {
  shape?: "cylinder" | "sphere" | "torus";
  p: number[];
  s: number[];
  color: string;
  rotation?: number[];
};
function ToolBody({ pieces }: { pieces: Piece[] }) {
  const geometry = useMemo(() => {
    const matrix = new T.Matrix4(),
      q = new T.Quaternion(),
      p = new T.Vector3(),
      scale = new T.Vector3(),
      color = new T.Color();
    const geos = pieces.map((part) => {
      const geo =
        part.shape === "cylinder"
          ? new T.CylinderGeometry(1, 1, 1, 18)
          : part.shape === "sphere"
            ? new T.SphereGeometry(1, 16, 10)
            : part.shape === "torus"
              ? new T.TorusGeometry(1, 0.15, 6, 20)
              : new T.BoxGeometry(1, 1, 1);
      p.fromArray(part.p);
      scale.fromArray(part.s);
      q.setFromEuler(
        new T.Euler(
          ...((part.rotation || [0, 0, 0]) as [number, number, number]),
        ),
      );
      matrix.compose(p, q, scale);
      geo.applyMatrix4(matrix);
      color.set(part.color);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }
      geo.setAttribute("color", new T.BufferAttribute(colors, 3));
      return geo;
    });
    const merged = mergeGeometries(geos)!;
    geos.forEach((g) => g.dispose());
    return merged;
  }, [pieces]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial vertexColors metalness={0.38} roughness={0.43} />
    </mesh>
  );
}
const lampParts: Piece[] = [
  {
    shape: "cylinder",
    p: [0, 0.015, 0],
    s: [0.028, 0.19, 0.028],
    color: "#6c5138",
  },
  {
    shape: "cylinder",
    p: [0, 0.17, -0.065],
    s: [0.089, 0.19, 0.089],
    rotation: [Math.PI / 2, 0, 0],
    color: "#b99555",
  },
  {
    shape: "cylinder",
    p: [0, 0.17, 0.038],
    s: [0.073, 0.025, 0.073],
    rotation: [Math.PI / 2, 0, 0],
    color: "#806640",
  },
  {
    shape: "torus",
    p: [0, 0.17, -0.167],
    s: [0.09, 0.09, 0.09],
    color: "#ead3a0",
  },
  {
    shape: "torus",
    p: [0, 0.17, 0.042],
    s: [0.062, 0.062, 0.062],
    color: "#debd79",
  },
  { p: [0, 0.27, -0.065], s: [0.065, 0.025, 0.12], color: "#695640" },
  {
    shape: "sphere",
    p: [0.058, 0.235, -0.03],
    s: [0.019, 0.012, 0.025],
    color: "#f0ce86",
  },
];
const pumpParts: Piece[] = [
  { shape: "cylinder", p: [0, 0, 0], s: [0.03, 0.18, 0.03], color: "#6e5134" },
  {
    shape: "cylinder",
    p: [0, 0.09, 0],
    s: [0.035, 0.022, 0.035],
    color: "#c9a96a",
  },
  {
    shape: "cylinder",
    p: [0, -0.09, 0],
    s: [0.035, 0.022, 0.035],
    color: "#c9a96a",
  },
];
const keyParts: Piece[] = [
  { p: [0, 0.04, 0], s: [0.035, 0.25, 0.023], color: "#9daaaa" },
  { p: [0, -0.035, 0], s: [0.049, 0.11, 0.036], color: "#6d5841" },
  {
    shape: "cylinder",
    p: [0, 0.225, 0],
    s: [0.065, 0.027, 0.065],
    rotation: [Math.PI / 2, 0, 0],
    color: "#b4bfba",
  },
  { p: [0, 0.225, -0.023], s: [0.056, 0.055, 0.033], color: "#504e42" },
  { p: [0, 0.225, -0.043], s: [0.041, 0.039, 0.016], color: "#d1bb87" },
];
/** A single bounded lamp model; the world renderer owns its actual aimed beam. */
export function ExpeditionHandLamp() {
  return (
    <group>
      <ToolBody pieces={lampParts} />
      <mesh position={[0, 0.17, -0.17]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.074, 24]} />
        <meshBasicMaterial
          color="#ffe0a2"
          side={T.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
export function ExpeditionPumpGrip() {
  return <ToolBody pieces={pumpParts} />;
}
export function ExpeditionAssemblyKey() {
  return <ToolBody pieces={keyParts} />;
}

const focusParts: Piece[] = [
  {
    shape: "cylinder",
    p: [0, 0.055, 0],
    s: [0.018, 0.13, 0.018],
    color: "#8e7958",
  },
  {
    shape: "torus",
    p: [0, 0.16, 0],
    s: [0.084, 0.084, 0.084],
    color: "#d6b778",
  },
  {
    shape: "cylinder",
    p: [0, 0.16, 0],
    s: [0.019, 0.06, 0.019],
    rotation: [Math.PI / 2, 0, 0],
    color: "#b4a47b",
  },
  { p: [0, 0.16, 0], s: [0.16, 0.012, 0.018], color: "#a38d5c" },
  {
    shape: "cylinder",
    p: [0.072, 0.16, 0.025],
    s: [0.017, 0.047, 0.017],
    rotation: [Math.PI / 2, 0, 0],
    color: "#71654d",
  },
];
export function ExpeditionFocusWheel() {
  return <ToolBody pieces={focusParts} />;
}
