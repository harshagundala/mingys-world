const brass = "#b58a42",
  wood = "#6c422d",
  darkWood = "#3f2923",
  cream = "#dfceb0",
  green = "#315a4e";
export function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  color = wood,
  rot = [0, 0, 0],
  metal = 0,
  emissive,
  cast = true,
}: {
  p?: number[];
  s?: number[];
  color?: string;
  rot?: number[];
  metal?: number;
  emissive?: string;
  cast?: boolean;
}) {
  return (
    <mesh
      position={p as any}
      rotation={rot as any}
      castShadow={cast}
      receiveShadow
    >
      <boxGeometry args={s as any} />
      <meshStandardMaterial
        color={color}
        roughness={metal ? 0.4 : 0.82}
        metalness={metal}
        emissive={emissive || "#000"}
        emissiveIntensity={emissive ? 0.8 : 0}
      />
    </mesh>
  );
}
export function Sphere({
  p,
  s,
  color,
}: {
  p: number[];
  s: number[];
  color: string;
}) {
  return (
    <mesh position={p as any} scale={s as any} castShadow>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}
export function Cylinder({
  p,
  r = 0.1,
  h = 1,
  color = brass,
  r2,
  rot = [0, 0, 0],
  metal = 0,
}: {
  p: number[];
  r?: number;
  r2?: number;
  h?: number;
  color?: string;
  rot?: number[];
  metal?: number;
}) {
  return (
    <mesh position={p as any} rotation={rot as any} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, 24]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={0.6} />
    </mesh>
  );
}

export function Plant({
  p = [0, 0, 0],
  scale = 1,
  flower = false,
}: {
  p?: number[];
  scale?: number;
  flower?: boolean;
}) {
  return (
    <group position={p as any} scale={scale}>
      <Cylinder p={[0, 0.22, 0]} r={0.24} r2={0.18} h={0.44} color="#ad6950" />
      <Cylinder p={[0, 0.44, 0]} r={0.255} h={0.08} color="#c48a66" />
      <Cylinder p={[0, 0.74, 0]} r={0.025} h={0.65} color="#436443" />
      {Array.from({ length: 7 }, (_, i) => (
        <group
          key={i}
          rotation={[0, i * 2.4, 0]}
          position={[0, 0.5 + i * 0.08, 0]}
        >
          <Sphere
            p={[0.17, 0.06, 0]}
            s={[0.26, 0.045, 0.085]}
            color={i % 2 ? "#57825c" : "#365b42"}
          />
          {flower && i > 3 && (
            <Sphere
              p={[0.23, 0.11, 0]}
              s={[0.09, 0.08, 0.09]}
              color={i % 2 ? "#d8ad84" : "#d17f92"}
            />
          )}
        </group>
      ))}
    </group>
  );
}

export function Lamp({
  p = [0, 0, 0],
  height = 2,
}: {
  p?: number[];
  height?: number;
}) {
  return (
    <group position={p as any}>
      <Cylinder p={[0, 0.06, 0]} r={0.25} h={0.12} color={brass} />
      <Cylinder p={[0, height / 2, 0]} r={0.025} h={height} color={brass} />
      <Cylinder
        p={[0, height, 0]}
        r={0.24}
        r2={0.45}
        h={0.45}
        color="#ead7a6"
      />
      <mesh position={[0, height - 0.1, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial
          color="#fff1bf"
          emissive="#ffcd71"
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
}
