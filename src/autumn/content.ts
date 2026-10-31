// Shared spatial contract. Narrative and progression are intentionally not in the launcher.
export type Role = 0 | 1;
export type Vec = [number, number, number];
export type ItemKind = "apple" | "pumpkin" | "mushroom" | "wood" | "spark";
export type Prop = {
  id: string;
  kind: ItemKind;
  x: number;
  z: number;
  phase: number;
};
export const colors = ["#e7aa52", "#79c7c3"];
export const names = ["Harsha", "Mingy"];
export const acts = [
  {
    name: "A little before nightfall",
    place: "Bramblewick Station",
    goal: "Find the two lanterns by the station. Light one each.",
    line: "The last train left two tickets, a very small town, and an evening with your names on it.",
    tip: "Walk to a glowing lantern and press E. Your partner lights the other one.",
    minutes: "2",
  },
  {
    name: "Something worth gathering",
    place: "The honey-gold orchard",
    goal: "Gather the harvest and bring it to the orchard cart.",
    line: "Bramblewick’s autumn fair has a problem. Its keeper has followed the last light into the hills. Tonight, the town is yours to look after.",
    tip: "Hold E near ripe produce. Release when the ring is gold for a perfect harvest. Carry up to three; E at the cart unloads them. Your harvest scores are just for fun.",
    minutes: "8–10",
  },
  {
    name: "Made by two",
    place: "The old mill",
    goal: "Gather timber, then build the six sections of the bridge together.",
    line: "The river has borrowed the bridge. The mill has tools, the woods have fallen branches, and neither of you has to be good at carpentry.",
    tip: "Collect fallen timber and unload it at the workbench. Begin a section there; take turns striking when the moving marker crosses gold. Three strikes each finish a section.",
    minutes: "8–9",
  },
  {
    name: "The long way round",
    place: "Lantern Run",
    goal: "Sail downriver. Stop at the three landings to collect the festival parcels.",
    line: "A boat called Almost Sensible is waiting. One of you takes the rudder, the other catches the wind. What could possibly go charmingly wrong?",
    tip: "Both board at the dock. Harsha steers with A/D. Mingy trims the sail with A/D to match the wind arrow. At each landing, both press E to collect your parcel. The boat waits safely if either connection drops.",
    minutes: "7–8",
  },
  {
    name: "A table for everyone",
    place: "The midnight kitchen",
    goal: "Cook eight plates together and deliver them to the waiting tables.",
    line: "The villagers are back. They are small, hungry, and extremely enthusiastic about butter. The kitchen is officially open.",
    tip: "Pick up the requested ingredient at a pantry. Prep it at the cutting board, then your partner finishes it at the stove. Press E again when the marker crosses gold. Serve the plate at the glowing table. Nothing burns while you reconnect.",
    minutes: "9–10",
  },
  {
    name: "A gloriously crooked fair",
    place: "The pumpkin green",
    goal: "Play four rounds of pumpkin toss. Five throws each per round.",
    line: "Dinner is served. The fair has one last tradition: a very serious championship with a very unserious trophy. Tonight, it belongs to one of you.",
    tip: "Stand at your throwing line. Look up a little, hold E to charge, aim the dotted arc at the glowing ring, then release. A closer landing scores more. Five throws each, then the ring moves. No one has to win to carry on.",
    minutes: "6–8",
  },
  {
    name: "Borrowing a little sky",
    place: "Windward Hill",
    goal: "Wake the six wind towers. One holds the ground switch while the other flies the kite.",
    line: "The fair is ready. The sky is not. A shy little storm has tangled the stars, and it will take two people to ask them back.",
    tip: "Stand on a tower’s amber ground switch. Your partner uses its teal reel, then steers the kite with A/D through the moving gold wind band. Swap roles at the next tower. Progress never runs backward.",
    minutes: "7–9",
  },
  {
    name: "What we leave glowing",
    place: "The wishing meadow",
    goal: "Make twelve lanterns, then meet at the two launch stones.",
    line: "Some evenings ask for a grand ending. This one asks for something you make with your hands, and someone to stand beside you.",
    tip: "Use the lantern table to choose a shape and color. Carry your lantern to a glowing stand. Make six each. When you are ready, meet at the two launch stones and release the sky together.",
    minutes: "6–8",
  },
  {
    name: "The light stays",
    place: "Bramblewick, after hours",
    goal: "Stay a little. The night is yours.",
    line: "The town did not need a keeper. It needed two people who would show up for each other. Happy Halloween, Mingies.",
    tip: "Explore, sit by the fire, or watch the lanterns. Your evening is saved.",
    minutes: "",
  },
];
export const stations: Record<
  string,
  { x: number; z: number; label: string; phase: number; role?: Role }
> = {
  "welcome-0": { x: -3, z: 32, label: "Light your lantern", phase: 0, role: 0 },
  "welcome-1": { x: 3, z: 32, label: "Light your lantern", phase: 0, role: 1 },
  cart: { x: -24, z: 5, label: "Unload harvest", phase: 1 },
  bench: { x: 26, z: -22, label: "The bridge workbench", phase: 2 },
  dock: { x: 0, z: -54, label: "Board Almost Sensible", phase: 3 },
  pantryApple: { x: -13, z: 13, label: "Apple pantry", phase: 4 },
  pantryMushroom: { x: 13, z: 13, label: "Mushroom pantry", phase: 4 },
  pantryPumpkin: { x: -12, z: 31, label: "Pumpkin pantry", phase: 4 },
  prep: { x: -5, z: 20, label: "Cutting board", phase: 4 },
  stove: { x: 5, z: 20, label: "Copper stove", phase: 4 },
  "pitch-0": {
    x: -10,
    z: 7,
    label: "Hold E to throw a pumpkin",
    phase: 5,
    role: 0,
  },
  "pitch-1": {
    x: 10,
    z: 7,
    label: "Hold E to throw a pumpkin",
    phase: 5,
    role: 1,
  },
  lanternTable: { x: 0, z: -4, label: "Make a lantern", phase: 7 },
  "launch-0": { x: -3, z: -43, label: "Release the light", phase: 7, role: 0 },
  "launch-1": { x: 3, z: -43, label: "Release the light", phase: 7, role: 1 },
};
export const tables = Array.from({ length: 8 }, (_, i) => ({
  id: `table-${i}`,
  x: Math.cos((i / 8) * Math.PI * 2) * 23,
  z: 17 + Math.sin((i / 8) * Math.PI * 2) * 11,
}));
export const towers = Array.from({ length: 6 }, (_, i) => ({
  id: `tower-${i}`,
  x: 36 * Math.cos((i / 6) * Math.PI * 2),
  z: -13 + 31 * Math.sin((i / 6) * Math.PI * 2),
}));
export const lanternStands = Array.from({ length: 12 }, (_, i) => ({
  id: `lantern-${i}`,
  x: 19 * Math.cos((i / 12) * Math.PI * 2),
  z: -27 + 13 * Math.sin((i / 12) * Math.PI * 2),
  role: (i % 2) as Role,
}));
export const wishes = [
  "For our next adventure",
  "For the little things",
  "For the miles between",
  "For coming home",
  "For laughing too much",
  "For us",
];
export const recipes = [
  "apple",
  "mushroom",
  "pumpkin",
  "apple",
  "pumpkin",
  "mushroom",
  "apple",
  "pumpkin",
] as const;
export const recipeNames = [
  "Cinnamon apple toast",
  "Wild mushroom pie",
  "Roasted pumpkin soup",
  "Caramel orchard tart",
  "Pumpkin & sage dumplings",
  "Moonlit mushroom toast",
  "Apple crumble for two",
  "The last slice of pumpkin pie",
];
export function rand(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export const obstacles = [
  { x: 0, z: 49, w: 5.4, d: 4.6 },
  { x: -22, z: 36, w: 3.9, d: 3.3 },
  { x: 23, z: 37, w: 3.9, d: 3.3 },
  { x: 36, z: 17, w: 3.4, d: 4 },
  { x: -39, z: 24, w: 3.3, d: 4 },
  { x: 38, z: -29, w: 5.5, d: 5 },
];
function reachableProp(p: Prop): Prop {
  for (const b of obstacles)
    if (Math.abs(p.x - b.x) < b.w + 1.5 && Math.abs(p.z - b.z) < b.d + 1.5)
      p = { ...p, z: b.z - b.d - 2 };
  return p;
}
export const props: Prop[] = (
  [
    ...Array.from({ length: 42 }, (_, i) => {
      const a = i * 2.39996,
        r = 10 + Math.sqrt(i / 42) * 30;
      return {
        id: `harvest-${i}`,
        kind: (["apple", "pumpkin", "mushroom"] as const)[i % 3],
        x: -25 + Math.cos(a) * r,
        z: -12 + Math.sin(a) * r,
        phase: 1,
      };
    }),
    ...Array.from({ length: 24 }, (_, i) => ({
      id: `wood-${i}`,
      kind: "wood" as const,
      x: 14 + rand(i + 100) * 43,
      z: -47 + rand(i + 200) * 58,
      phase: 2,
    })),
  ] as Prop[]
).map(reachableProp);
export const moths = Array.from({ length: 8 }, (_, i) => ({
  id: `moth-${i}`,
  x: Math.cos(i * 2.399) * (44 + i * 2),
  z: Math.sin(i * 2.399) * (38 + i * 2),
}));
export type Pose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  moving: boolean;
  time: number;
  seq: number;
  control?: number;
  gesture?: string;
  gestureAt?: number;
  scene: "valley" | "river";
};
export const spawn = (role: Role): Pose => ({
  x: role ? 1.6 : -1.6,
  y: 0,
  z: 40,
  yaw: 0,
  pitch: 0,
  moving: false,
  time: 0,
  seq: 0,
  scene: "valley",
});
export const distance = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => Math.hypot(a.x - b.x, a.z - b.z);
export const riverLength = 900;
export const riverStops = [170, 370, 570];
export const windAt = (progress: number) => Math.sin(progress * 0.023) * 0.65;
export const riverBends = (progress: number) =>
  Math.sin(progress * 0.016) * 5 + Math.sin(progress * 0.041) * 2;

export const fairTarget = (round: number, role: Role) => ({
  x: (role ? -1 : 1) * Math.sin(round * 1.7) * 5 + (role ? 10 : -10),
  z: -9 - round * 4,
});
export function throwPath(
  p: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  held: number,
  t: number,
) {
  const speed = 8 + Math.min(1, Math.max(0, held / 1500)) * 14;
  return {
    x: p.x - Math.sin(yaw) * Math.cos(pitch) * speed * t,
    y: p.y + 1.5 + Math.sin(pitch) * speed * t - 4.9 * t * t,
    z: p.z - Math.cos(yaw) * Math.cos(pitch) * speed * t,
  };
}
export function throwLanding(
  p: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  held: number,
) {
  const speed = 8 + Math.min(1, Math.max(0, held / 1500)) * 14;
  const vy = Math.sin(pitch) * speed;
  const t = (vy + Math.sqrt(vy * vy + 19.6 * (p.y + 1.5))) / 9.8;
  return { ...throwPath(p, yaw, pitch, held, t), duration: t };
}
