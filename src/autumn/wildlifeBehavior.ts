import { obstacles } from "./content";
export type WildlifeKind = "deer" | "rabbit";
export type AnimalSpec = {
  id: number;
  kind: WildlifeKind;
  x: number;
  z: number;
  scale: number;
  yaw: number;
};
export type Observer = {
  x: number;
  z: number;
  moving: boolean;
  scene?: string;
};
export const wildlifeHomes: AnimalSpec[] = [
  { id: 0, kind: "deer", x: -45, z: -8, scale: 1, yaw: 1.15 },
  { id: 1, kind: "deer", x: -49, z: -13, scale: 0.82, yaw: 0.75 },
  { id: 2, kind: "rabbit", x: -18, z: 8, scale: 1, yaw: -0.5 },
  { id: 3, kind: "rabbit", x: -20, z: 11, scale: 0.88, yaw: -0.1 },
  { id: 4, kind: "rabbit", x: -15, z: 11, scale: 0.78, yaw: 0.5 },
];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (v: number) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
/** Pure shared-clock behavior: browser frame rate and join time never choose the animal's route. */
export function wildlifePlan(
  animal: AnimalSpec,
  time: number,
  players: Observer[],
  phase: number,
) {
  const seed = animal.id * 7.31;
  const cycle = (((time + seed) % 48) + 48) % 48;
  const route = smooth((cycle - 17) / 9) - smooth((cycle - 38) / 10);
  const routeSize = animal.kind === "deer" ? 1.65 : 1.05;
  let x = animal.x + Math.sin(animal.yaw) * route * routeSize;
  let z = animal.z + Math.cos(animal.yaw) * route * routeSize;
  const observers = players.filter(
    (p) => p.scene !== "river" && Number.isFinite(p.x) && Number.isFinite(p.z),
  );
  let nearest: Observer | undefined,
    distance = Infinity;
  for (const p of observers) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < distance) {
      distance = d;
      nearest = p;
    }
  }
  const bothCalm =
    observers.length === 2 &&
    observers.every(
      (p) => !p.moving && Math.hypot(p.x - animal.x, p.z - animal.z) < 11,
    );
  const nervous = nearest
    ? Math.max(
        nearest.moving ? 1 - smooth((distance - 2) / 4) : 0,
        1 - smooth((distance - 1) / 1.3),
      )
    : 0;
  if (nearest && nervous > 0.001) {
    const length = Math.max(0.01, distance);
    const dx = (x - nearest.x) / length,
      dz = (z - nearest.z) / length;
    x += dx * nervous * 2.8;
    z += dz * nervous * 2.8;
  } else if (bothCalm) {
    const mid = {
      x: (observers[0].x + observers[1].x) / 2,
      z: (observers[0].z + observers[1].z) / 2,
    };
    const length = Math.hypot(mid.x - x, mid.z - z),
      step = Math.min(2.2, Math.max(0, length - 2.7));
    if (length > 0.01) {
      x += ((mid.x - x) / length) * step;
      z += ((mid.z - z) / length) * step;
    }
  }
  // Keep every route in its clearing and away from hard geometry and the water.
  x = clamp(x, animal.x - 4.2, animal.x + 4.2);
  z = clamp(z, animal.z - 4.2, animal.z + 4.2);
  for (const b of obstacles) {
    if (Math.abs(x - b.x) < b.w + 0.8 && Math.abs(z - b.z) < b.d + 0.8) {
      const dx = b.w + 0.8 - Math.abs(x - b.x),
        dz = b.d + 0.8 - Math.abs(z - b.z);
      if (dx < dz) x = b.x + Math.sign(x - b.x || 1) * (b.w + 0.8);
      else z = b.z + Math.sign(z - b.z || 1) * (b.d + 0.8);
    }
  }
  const walking = (cycle > 17 && cycle < 26) || cycle > 38;
  const graze =
    !walking && distance > 6 && nervous < 0.01
      ? 0.5 + 0.5 * Math.sin(time * 0.33 + seed)
      : 0;
  let yaw = animal.yaw + (cycle > 38 ? Math.PI : 0);
  if (nearest && distance < 8)
    yaw =
      Math.atan2(nearest.x - x, nearest.z - z) + (nervous > 0.05 ? Math.PI : 0);
  return {
    x,
    z,
    yaw,
    graze,
    nervous,
    curious: bothCalm && nervous < 0.01,
    leaf: animal.kind === "rabbit" && animal.id === 2 && bothCalm && phase >= 1,
  };
}
