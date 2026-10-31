import type { Role } from "./content";

export type ExpeditionRoute = "water" | "light";
export type ExpeditionPoint = { x: number; z: number };
export type ExpeditionState = {
  water: number[];
  light: number[];
  waterCharge: [number, number, number];
  lightCharge: [number, number, number];
  operator: null | {
    route: ExpeditionRoute;
    index: number;
    role: Role;
    value: number;
    at: number;
  };
  receiver: null | { index: number; role: Role; value: number; at: number };
  firstRoute: ExpeditionRoute | null;
  routeOrder: ExpeditionRoute[];
  carry: {
    holders: Role[];
    checkpoint: number;
    x: number;
    z: number;
    at: number;
    delivered: boolean;
  };
  assembly: number;
  assemblyReady: { role: Role; at: number }[];
  keepsakes: Role[];
  returnReady: Role[];
  completed: boolean;
  at: number;
};
export type Expedition = ExpeditionState;

export const expeditionControls = {
  water: { x: -34, z: 15 },
  light: { x: 34, z: 15 },
} satisfies Record<ExpeditionRoute, ExpeditionPoint>;
export const waterReceivers: ExpeditionPoint[] = [
  { x: -62, z: 15 },
  { x: -62, z: -10 },
  { x: -42, z: -27 },
];
export const lightReceivers: ExpeditionPoint[] = [
  { x: 63, z: 14 },
  { x: 61, z: -12 },
  { x: 37, z: -30 },
];
export const heartStart: ExpeditionPoint = { x: 0, z: 18 };
export const carryWaypoints: ExpeditionPoint[] = [
  { x: -14, z: 2 },
  { x: -6, z: -16 },
  { x: 0, z: -28 },
  { x: 0, z: -42 },
];
export const conservatory: ExpeditionPoint = { x: 0, z: -50 };
export const heartCradle: ExpeditionPoint = { x: 0, z: -46 };
export const assemblyPads: [ExpeditionPoint, ExpeditionPoint][] = [
  [
    { x: -6, z: -43 },
    { x: 6, z: -43 },
  ],
  [
    { x: -9, z: -50 },
    { x: 9, z: -50 },
  ],
  [
    { x: -4, z: -57 },
    { x: 4, z: -57 },
  ],
];
export const assemblyFocus = { x: 0, y: 2.3, z: -50 };
export const returnPoint: ExpeditionPoint = { x: 0, z: -62 };
export const lookout: ExpeditionPoint = { x: 55, z: 40 };
export const expeditionBounds = 80;
export const hollowObstacles = [
  { x: -12, z: -50, w: 0.35, d: 13.2 },
  { x: 12, z: -50, w: 0.35, d: 13.2 },
  { x: -7.5, z: -37, w: 4.5, d: 0.35 },
  { x: 7.5, z: -37, w: 4.5, d: 0.35 },
  { x: -7.5, z: -63, w: 4.5, d: 0.35 },
  { x: 7.5, z: -63, w: 4.5, d: 0.35 },
];
export const expeditionOperator = (
  route: ExpeditionRoute,
  index: number,
): Role => ((index + (route === "light" ? 1 : 0)) % 2) as Role;

export const hollowSpawn = (role: Role) => ({
  x: role ? 1.6 : -1.6,
  y: 0,
  z: 48,
  yaw: 0,
  pitch: 0,
  moving: false,
  time: 0,
  seq: 0,
  scene: "hollow" as const,
});

/** The gauge shifts slowly enough to track with a laptop keyboard. */
export function waterTarget(index: number, now: number) {
  return Math.sin(now / 6100 + index * 1.8) * 0.58;
}

/** A real world-space moving receiver shared by renderer and authoritative aim checks. */
export function lightReceiverPosition(index: number, now: number) {
  const base = lightReceivers[Math.max(0, Math.min(2, index))];
  const phase = now / 3900 + index * 2.1;
  return {
    x: base.x + Math.sin(phase) * 2.6,
    y: 2.35 + Math.sin(phase * 0.73) * 0.55,
    z: base.z + Math.cos(phase * 0.81) * 1.8,
  };
}
export const lightReceiver = lightReceiverPosition;

export const expeditionChargeSeconds = { water: 26, light: 26 };
export const expeditionPressureTolerance = 0.22;
export const expeditionBeamTolerance = 0.055;
export const expeditionFocusTolerance = 0.2;
export function focusTarget(index: number, now: number) {
  return Math.sin(now / 4700 + index * 2.3 + 0.7) * 0.62;
}
export const assemblyPairWindow = 3000;

/** Positive pitch looks upward; local forward is -Z, matching the first-person camera. */
export function receiverAlignment(
  pose: { x: number; y: number; z: number; yaw: number; pitch: number },
  receiver: { x: number; y: number; z: number },
) {
  const dx = receiver.x - pose.x,
    dy = receiver.y - (pose.y + 1.65),
    dz = receiver.z - pose.z;
  const length = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(length) || length < 0.01) return 0;
  return (
    (-Math.sin(pose.yaw) * Math.cos(pose.pitch) * dx +
      Math.sin(pose.pitch) * dy -
      Math.cos(pose.yaw) * Math.cos(pose.pitch) * dz) /
    length
  );
}

export const expeditionPathsComplete = (state: ExpeditionState) =>
  state.water.length === 3 && state.light.length === 3;
