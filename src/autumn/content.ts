import type { Expedition } from "./expeditionContent";
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
/** Saved phase IDs stay stable; this sequence is the order players experience them. */
export const chapterOrder = [0, 1, 2, 3, 4, 5, 9, 6, 7, 8] as const;
export function chapterNumber(phase: number) {
  return Math.max(1, chapterOrder.findIndex((id) => id === phase) + 1);
}
/** First-play pacing estimate, including the optional-order middle act. */
export const adventureMinutes = "75–85";
export const acts = [
  {
    name: "A little before nightfall",
    place: "Bramblewick Station",
    goal: "Find the two lanterns by the station. Light one each.",
    line: "The last train left two tickets, a very small town, and an evening with your names on it.",
    note: "Two tickets. No return time. A pressed maple leaf between them. Start with the lamps beside the station.",
    tip: "Walk to a glowing lantern and press E. Your partner lights the other one.",
    minutes: "2",
  },
  {
    name: "The keeper’s invitation",
    place: "The honey-gold orchard",
    goal: "Gather the harvest and bring it to the orchard cart.",
    line: "The lanterns reveal a note: “Harsha & Mingy—tonight’s keepers. The storm broke our festival. Carry these two flames through the evening. We’ll need them to fill the sky. Start by bringing everyone back to the table.”",
    note: "Keeper’s note, margin: “A town goes dark one empty table at a time. Begin with apples, pumpkins, and mushrooms. The lights can wait for supper.”",
    tip: "Hold E near ripe produce. Release when the ring is gold for a perfect harvest. Carry up to three; E at the cart unloads them. Your harvest scores are just for fun.",
    minutes: "8–10",
  },
  {
    name: "Made by two",
    place: "The old mill",
    goal: "Gather timber, then build the six sections of the bridge together.",
    line: "Your harvest will feed the fair. Its lantern paper, wicks, and wax are stranded downriver. First, you need a bridge. The old mill has tools; the fallen branches have a second life.",
    note: "Workshop note: “Six sections. No heroics. A bridge is a promise that someone on the other side can get home.”",
    tip: "Collect fallen timber and unload it at the workbench. Begin a section there; take turns striking when the moving marker crosses gold. Three strikes each finish a section.",
    minutes: "8–9",
  },
  {
    name: "The long way round",
    place: "Lantern Run",
    goal: "Sail downriver. Stop at the three landings to collect the festival parcels.",
    line: "The bridge leads to Almost Sensible, the keeper’s famously optimistic boat. Three landings hold the missing parcels. Take the rudder, catch the wind, and bring the evening home.",
    note: "Delivery list: Willow Bend, The Little Landing, Moonwater. Every parcel is marked FOR THE LAST LIGHT. Underneath, in smaller letters: KEEP DRY.",
    tip: "Cross the bridge you built and both board at the far landing. Harsha steers with A/D. Mingy trims the sail with A/D to match the wind arrow. At each landing, both press E to collect your parcel. The boat waits safely if either connection drops.",
    minutes: "7–8",
  },
  {
    name: "A table for everyone",
    place: "The midnight kitchen",
    goal: "Cook eight plates together and deliver them to the waiting tables.",
    line: "Paper, wicks, wax: the makings of a sky full of lanterns. But the keeper’s note has one rule: “Feed the people who will watch them.” Your harvest is waiting at the kitchen.",
    note: "Recipe-book inscription: “One pair of hands starts a dish. Another finishes it. That’s how you know it was made for company.”",
    tip: "Pick up the requested ingredient at a pantry. Prep it at the cutting board, then your partner finishes it at the stove. Press E again when the marker crosses gold. Serve the plate at the glowing table. Nothing burns while you reconnect.",
    minutes: "9–10",
  },
  {
    name: "A gloriously crooked fair",
    place: "The pumpkin green",
    goal: "Play four rounds of pumpkin toss. Five throws each per round.",
    line: "Eight warm plates, and the fair is back. The villagers insist you settle one extremely important matter before the lights go up: which Mingy throws the least ridiculous pumpkin? Beyond the green, the old glasshouse waits in the dark.",
    note: "Official fair regulations: “No bruised feelings. No borrowing a champion’s pumpkin. Ties count as an excellent excuse to come back.”",
    tip: "Stand at your throwing line. Look up a little, hold E to charge, aim the dotted arc at the glowing ring, then release. A closer landing scores more. Five throws each, then the ring moves. No one has to win to carry on.",
    minutes: "6–8",
  },
  {
    name: "Borrowing a little sky",
    place: "Windward Hill",
    goal: "Wake the six wind towers. One holds the ground switch while the other flies the kite.",
    line: "The storm is loosening its grip. Six old wind towers can turn a break in the weather into a safe passage for your lanterns. One of you reaches for the sky; the other keeps steady below.",
    note: "Keeper’s field note: “Every person who reaches for the sky needs someone on the ground. Trade places. Remember how both jobs feel.”",
    tip: "Stand on a tower’s amber ground switch. Your partner uses its teal reel, then steers the kite with A/D through the moving gold wind band. Swap roles at the next tower. Progress never runs backward.",
    minutes: "7–9",
  },
  {
    name: "What we leave glowing",
    place: "The wishing meadow",
    goal: "Make twelve lanterns, then meet at the two launch stones.",
    line: "The wind settles. Twelve lanterns. Your colors, your shapes, your wishes. And the same little flames you found at the station. Make something only the two of you could have made.",
    note: "The last instruction: “A lantern is a little room for a wish. Make it yours. Then leave the door open.”",
    tip: "Use the lantern table to choose a shape and color. Carry your lantern to a glowing stand. Make six each. When you are ready, meet at the two launch stones and release the sky together.",
    minutes: "6–8",
  },
  {
    name: "The light stays",
    place: "Bramblewick, after hours",
    goal: "Stay a little. The night is yours.",
    line: "Two lights at a quiet station. A bridge you built, a table you filled, a sky you made together. Bramblewick will remember its keepers: Harsha & Mingy. Happy Halloween, Mingies.",
    note: "The keeper’s register has two new names. Under “what was saved,” someone has written: the evening.",
    tip: "Explore, linger by the fire, or watch the lanterns. Your evening is saved.",
    minutes: "",
  },
  {
    name: "The house that held the storm",
    place: "The hollow & the glasshouse",
    goal: "Wake the Waterworks and Lantern Trail. Find what is holding the weather.",
    line: "Beyond the fair, the old glasshouse is breathing cold air into the valley. Something inside is holding the storm in place. Two routes disappear into the hollow: one follows water, the other follows light.",
    note: "A margin in the keeper’s map: “Water gives it a pulse. Light shows it the way. The glassheart remembers how the two belong together.” Either path is yours to begin.",
    tip: "Choose either route; E takes a station. Waterworks: one pumps with A/D while the other calls corrections from the target gauge. Lantern Trail: one aims the beam; the other presses E at the receiver and uses A/D to focus it. E recovers a charged receiver. Swap jobs at each station.",
    minutes: "15–20",
  },
];
/** A concise HUD objective for the current beat, with stable legacy chapter text. */
export function chapterGoal(phase: number, expedition?: Expedition) {
  if (phase !== 9 || !expedition) return acts[phase].goal;
  const e = expedition;
  if (e.assembly >= 3)
    return "Return to the valley together, or stay a little longer.";
  if (e.carry.delivered)
    return "Complete three paired assembly beats in the glasshouse.";
  if (e.water.length >= 3 && e.light.length >= 3) {
    if (e.carry.checkpoint >= 4) return "Set the glassheart into its cradle.";
    if (e.carry.holders.length === 2)
      return "Carry the glassheart to the glasshouse together.";
    return "Meet at the glassheart. Take one handle each.";
  }
  if (e.water.length >= 3) return "Finish the Lantern Trail together.";
  if (e.light.length >= 3) return "Finish the Waterworks together.";
  return acts[phase].goal;
}

/** Instructions follow the current saved beat, never a later chapter. */
export function chapterTip(phase: number, expedition?: Expedition) {
  if (phase !== 9 || !expedition) return acts[phase].tip;
  const e = expedition;
  if (e.assembly >= 3)
    return "The glasshouse is awake. Stay to explore, or both meet at the return marker and press E to go back to the valley.";
  if (e.carry.delivered)
    return "Stand on the two marked assembly pads. Count down and press E within three seconds of each other. Repeat at three successive pairs to open the roof. A missed beat keeps every finished part.";
  if (e.water.length >= 3 && e.light.length >= 3) {
    if (e.carry.checkpoint >= 4)
      return "The glassheart is home. Keep both handles held, approach the central cradle, and press E to set it in place.";
    if (e.carry.holders.length === 2)
      return "Walk the glassheart through the lit waypoints together. Keep close and match your partner’s pace. Stop whenever you need to regroup; each waypoint saves your crossing.";
    return "Both paths are awake. Meet at the glassheart and press E on your handles. Then carry it through the marked waypoints together; neither of you can move it alone.";
  }
  if (e.operator?.route === "water")
    return "The pump operator uses A/D to adjust pressure. Only your partner’s gauge shows the target, so they call out corrections. When it is charged, your partner presses E at the receiver. Swap jobs at the next station.";
  if (e.operator?.route === "light")
    return "One player aims at the moving receiver with the mouse or two-finger drag. The other presses E at the receiver, then uses A/D to focus the ring. Keep both aligned until charged; the player at the receiver presses E again to recover it.";
  if (e.water.length >= 3)
    return "The Waterworks is restored. On the Lantern Trail, E takes the lantern or focus controls. One player aims the beam; the other focuses with A/D. When both align and the charge fills, the player at the receiver presses E again.";
  if (e.light.length >= 3)
    return "The Lantern Trail is restored. Follow the Waterworks: E takes a pump. Your partner reads the target gauge and calls corrections while you adjust with A/D. Your partner presses E at the receiver when it is charged.";
  return acts[phase].tip;
}

export const stations: Record<
  string,
  { x: number; z: number; label: string; phase: number; role?: Role }
> = {
  "welcome-0": { x: -3, z: 32, label: "Light your lantern", phase: 0, role: 0 },
  "welcome-1": { x: 3, z: 32, label: "Light your lantern", phase: 0, role: 1 },
  cart: { x: -24, z: 5, label: "Unload harvest", phase: 1 },
  bench: { x: 26, z: -22, label: "The bridge workbench", phase: 2 },
  dock: { x: 0, z: -79, label: "Board Almost Sensible", phase: 3 },
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
  scene: "valley" | "river" | "hollow";
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
