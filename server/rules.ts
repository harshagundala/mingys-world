import {
  clues,
  required,
  signalCodes,
  decoder,
  fuses,
  places,
} from "../src/game/content.ts";
export type Pose = {
  place: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  moving: boolean;
  time: number;
};
export type GameState = {
  version: number;
  chapter: number;
  started: number;
  finished: number | null;
  found: string[];
  balls: string[];
  bells: number[];
  water: boolean;
  plateSince: number | null;
  round: number;
  powerUntil: number | null;
  fuses: string[];
  finalPaws: Record<string, number>;
  players: Record<string, { id: string; name: string }>;
  attempts: number;
  galleryIndex?: number;
};
export const initialState = (): GameState => ({
  version: 0,
  chapter: 0,
  started: Date.now(),
  finished: null,
  found: [],
  balls: [],
  bells: [],
  water: false,
  plateSince: null,
  round: 0,
  powerUntil: null,
  fuses: [],
  finalPaws: {},
  players: {},
  attempts: 0,
  galleryIndex: 0,
});
export function near(
  p: Pose | undefined,
  place: string,
  x: number,
  z: number,
  r = 3.2,
) {
  return !!p && p.place === place && Math.hypot(p.x - x, p.z - z) < r;
}
export function reduceAction(
  original: GameState,
  role: number,
  a: any,
  poses: Record<string, Pose>,
  now = Date.now(),
): { state: GameState; message?: string; changed: boolean } {
  const s = structuredClone(original),
    p = poses[role];
  let message = "";
  const item = clues.find((c) => c.id === a.id);
  const nearby = !!item && near(p, item.place, item.pos[0], item.pos[2]);
  if (
    a.kind === "memory" &&
    s.chapter === 8 &&
    Number.isInteger(a.index) &&
    a.index >= 0 &&
    a.index < 30
  ) {
    s.galleryIndex = a.index;
  } else if (
    a.kind === "read" &&
    item &&
    nearby &&
    (item.kind === undefined || item.kind === "photo") &&
    item.chapter <= s.chapter
  ) {
    if (!s.found.includes(item.id)) s.found.push(item.id);
  } else if (a.kind === "ball" && item?.kind === "ball" && nearby) {
    if (!s.balls.includes(item.id)) {
      s.balls.push(item.id);
      message = `Tennis ball found · ${s.balls.length}/5. Extremely professional detective work.`;
    }
  } else if (a.kind === "bell" && near(p, "house", 1.1, 5) && s.chapter === 0) {
    if (!s.bells.includes(role)) s.bells.push(role);
    if (s.bells.length === 2) {
      s.chapter = 1;
      message = "Two detectives have arrived. The house is listening.";
    } else message = "Your bell is rung. Waiting for your other Mingy.";
  } else if (a.kind === "solve") {
    const target: Record<number, string> = {
      1: "clock",
      2: "evidence",
      3: "valves",
      4: "signal",
      6: "sky",
    };
    if (item?.id !== target[s.chapter] || !nearby)
      return {
        state: original,
        changed: false,
        message: "Move closer to the puzzle to use it.",
      };
    const missing = (required[s.chapter] || []).filter(
      (id) => !s.found.includes(id),
    );
    if (missing.length)
      return {
        state: original,
        changed: false,
        message: `There ${missing.length === 1 ? "is" : "are"} still ${missing.length} undiscovered ${missing.length === 1 ? "trace" : "traces"} for this chapter. Check the notebook.`,
      };
    let correct = false;
    if (s.chapter === 1)
      correct = String(a.answer).replace(/[^0-9]/g, "") === "2140";
    if (s.chapter === 2)
      correct =
        JSON.stringify(a.answer?.guests) ===
          JSON.stringify(["Vale", "Ada", "Pip", "Iris"]) &&
        JSON.stringify(a.answer?.times) ===
          JSON.stringify(["21:10", "20:40", "21:25", "20:55"]);
    if (s.chapter === 3)
      correct =
        JSON.stringify(a.answer) ===
        JSON.stringify(["fern", "rose", "lily", "ivy"]);
    if (s.chapter === 4) {
      if (role !== 1)
        return {
          state: original,
          changed: false,
          message:
            "The rose collar operates the receiver. Read your transmission to your partner.",
        };
      correct =
        JSON.stringify(a.answer) ===
        JSON.stringify(signalCodes[s.round].map((n) => decoder[n]));
    }
    if (s.chapter === 6)
      correct =
        JSON.stringify(a.answer) ===
        JSON.stringify(["moon", "comet", "sun", "paw", "key"]);
    if (correct) {
      if (s.chapter === 3) {
        s.water = true;
        message =
          "The water is flowing. One puppy on each glowing seal. Stay together for three seconds.";
      } else if (s.chapter === 4 && s.round < 2) {
        s.round++;
        message = `Transmission ${s.round}/3 received. The next signal is ready.`;
      } else {
        s.chapter++;
        message =
          [
            "",
            "",
            "The clock remembers. The upstairs library is open.",
            "A new lead. The moon garden is open.",
            "",
            "",
            "Power restored. The observatory is open.",
            "The Star has returned to the entrance hall.",
          ][s.chapter] || "The house remembers a little more.";
      }
    } else {
      s.attempts++;
      message =
        "That doesn’t fit all the evidence yet. Compare the coloured clues; you can try again.";
    }
  } else if (a.kind === "plate" && s.chapter === 3 && s.water) {
    const active =
      (near(poses[0], "garden", -3, -4, 1.15) &&
        near(poses[1], "garden", 3, -4, 1.15)) ||
      (near(poses[1], "garden", -3, -4, 1.15) &&
        near(poses[0], "garden", 3, -4, 1.15));
    const fresh =
      poses[0] &&
      poses[1] &&
      now - poses[0].time < 5000 &&
      now - poses[1].time < 5000;
    if (active && fresh) {
      if (!s.plateSince) s.plateSince = now;
      if (now - s.plateSince >= 2800) {
        s.chapter = 4;
        message = "Something below the garden has opened.";
      }
    } else s.plateSince = null;
  } else if (
    a.kind === "power-start" &&
    s.chapter === 5 &&
    near(p, "lab", 7, -6)
  ) {
    if (!(
      poses[1 - role]?.place === "lab" && now - poses[1 - role].time < 10000
    ))
      return {
        state: original,
        changed: false,
        message: "Bring both Mingys into the workshop before starting.",
      };
    if (!s.powerUntil || s.powerUntil < now) {
      s.powerUntil = now + 100_000;
      s.fuses = [];
      message =
        "Backup run started. Each find your three coloured fuses. You have 100 seconds.";
    }
  } else if (a.kind === "fuse" && s.chapter === 5) {
    const f = fuses.find((f) => f.id === a.id);
    if (
      f &&
      f.role === role &&
      near(p, "lab", f.x, f.z, 2.2) &&
      s.powerUntil &&
      s.powerUntil > now
    ) {
      if (!s.fuses.includes(f.id)) {
        s.fuses.push(f.id);
        message = `Fuse restored · ${s.fuses.length}/6`;
      }
      if (s.fuses.length === 6) {
        s.chapter = 6;
        s.powerUntil = null;
        message = "All six fuses restored. The sky is waiting upstairs.";
      }
    } else if (s.powerUntil && s.powerUntil <= now)
      message =
        "The backup run expired. Restart at the console; your investigation is safe.";
  } else if (a.kind === "final" && s.chapter === 7 && near(p, "house", 0, 0)) {
    s.finalPaws[role] = now;
    if (
      s.finalPaws[1 - role] &&
      now - s.finalPaws[1 - role] < 8000 &&
      near(poses[1 - role], "house", 0, 0, 4) &&
      now - poses[1 - role].time < 10000
    ) {
      s.chapter = 8;
      s.finished = now;
      message = "Distance, overruled. Welcome home, Mingys.";
    } else
      message =
        "Your paw is on the heart. Your other Mingy has eight seconds to join you.";
  }
  const changed = JSON.stringify(s) !== JSON.stringify(original);
  if (changed) s.version++;
  return { state: s, message, changed };
}
export function travelTarget(state: GameState, pose: Pose, id: string) {
  const item = clues.find((c) => c.id === id && c.kind === "portal");
  if (
    !item ||
    item.chapter > state.chapter ||
    !near(pose, item.place, item.pos[0], item.pos[2])
  )
    return null;
  return item.target
    ? { place: item.target, position: places[item.target].spawn }
    : null;
}
