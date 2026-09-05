import {
  dreamRoutes,
  dreamTile,
  dreamNavigator,
  circuitInitial,
  circuitSolved,
  mirrorTargets,
} from "../src/game/adventure.ts";
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
  archiveOpen?: boolean;
  dreamRound?: number;
  dreamStep?: number;
  circuit?: number[];
  skyAligned?: boolean;
  mirrors?: number[];
  mirrorRound?: number;
  mirrorPaws?: Record<string, number>;
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
  archiveOpen: false,
  dreamRound: 0,
  dreamStep: 0,
  circuit: [...circuitInitial],
  skyAligned: false,
  mirrors: [0, 0],
  mirrorRound: 0,
  mirrorPaws: {},
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
  } else if (a.kind === "dream-step" && s.chapter === 2 && s.archiveOpen) {
    const round = s.dreamRound || 0,
      step = s.dreamStep || 0,
      nav = dreamNavigator(round);
    if (
      round >= 3 ||
      role === nav ||
      !Number.isInteger(a.tile) ||
      a.tile < 0 ||
      a.tile > 24
    )
      return {
        state: original,
        changed: false,
        message:
          "The reader stays at the atlas; the other Mingy walks the tiles.",
      };
    const tile = dreamTile(a.tile);
    if (!near(p, "dream", tile.x, tile.z, 1.05))
      return {
        state: original,
        changed: false,
        message: "Stand on the tile before committing it.",
      };
    if (!near(poses[nav], "dream", -8, 5, 3.2) || now - poses[nav].time > 5000)
      return {
        state: original,
        changed: false,
        message: "Your map reader needs to stay at the atlas lectern.",
      };
    if (["dream-a", "dream-b", "dream-c"].some((id) => !s.found.includes(id)))
      return {
        state: original,
        changed: false,
        message:
          "Find the three field notes around this impossible room first.",
      };
    if (dreamRoutes[round][step] === a.tile) {
      s.dreamStep = step + 1;
      message = `Thread followed · ${step + 1}/${dreamRoutes[round].length}`;
      if (s.dreamStep === dreamRoutes[round].length) {
        s.dreamRound = round + 1;
        s.dreamStep = 0;
        message =
          round === 0
            ? "The paper folds. Swap jobs: rose reads, mint walks."
            : round === 1
              ? "One last fold. Mint reads the final map."
              : "The room exhales. Iris left a trail into the moon garden.";
        if (s.dreamRound === 3) s.chapter = 3;
      }
    } else {
      s.dreamStep = 0;
      message =
        "The path folds back to its beginning. Only this map resets; compare the names again.";
    }
  } else if (a.kind === "circuit-turn" && s.chapter === 4 && s.round === 3) {
    const cell = a.cell;
    if (
      !Number.isInteger(cell) ||
      cell < 0 ||
      cell >= 16 ||
      (Math.floor(cell / 4) + (cell % 4)) % 2 !== role ||
      !near(p, "lab", role === 0 ? -8 : 8, -5)
    )
      return {
        state: original,
        changed: false,
        message: "Use your own wall panel and your own coloured pipes.",
      };
    s.circuit = [...(s.circuit || circuitInitial)];
    s.circuit[cell] = (s.circuit[cell] + 1) % 4;
    if (circuitSolved(s.circuit)) {
      s.chapter = 5;
      message =
        "The circuit is whole. The Star wakes up… and every alarm in the house wakes with it.";
    }
  } else if (
    (a.kind === "mirror-turn" || a.kind === "mirror-hold") &&
    s.chapter === 6 &&
    s.skyAligned
  ) {
    if (!near(p, "observatory", role === 0 ? -6 : 6, 0))
      return {
        state: original,
        changed: false,
        message: "Stand at your collar’s mirror pedestal.",
      };
    s.mirrors = [...(s.mirrors || [0, 0])];
    s.mirrorPaws = { ...(s.mirrorPaws || {}) };
    if (a.kind === "mirror-turn") {
      if (a.direction !== 1 && a.direction !== -1)
        return { state: original, changed: false };
      s.mirrors[role] = (s.mirrors[role] + a.direction + 12) % 12;
      s.mirrors[1 - role] =
        (s.mirrors[1 - role] + a.direction * (role === 0 ? 2 : 3) + 36) % 12;
      s.mirrorPaws = {};
    } else {
      const target = mirrorTargets[s.mirrorRound || 0];
      if (!target.every((v, i) => s.mirrors![i] === v))
        return {
          state: original,
          changed: false,
          message:
            "The two mirrors are not both on their targets yet. Compare what your collars reveal.",
        };
      s.mirrorPaws[role] = now;
      if (
        s.mirrorPaws[1 - role] &&
        now - s.mirrorPaws[1 - role] < 8000 &&
        near(poses[1 - role], "observatory", role === 0 ? 6 : -6, 0) &&
        now - poses[1 - role].time < 5000
      ) {
        s.mirrorRound = (s.mirrorRound || 0) + 1;
        s.mirrorPaws = {};
        message = `Constellation held · ${s.mirrorRound}/3`;
        if (s.mirrorRound === 3) {
          s.chapter = 7;
          message =
            "The roof becomes a sky full of arriving lights. The house finally understands the way home.";
        }
      } else
        message =
          "Your reflection is held. Your Mingy has eight seconds to hold theirs.";
    }
  } else if (a.kind === "solve") {
    if (
      (s.chapter === 2 && s.archiveOpen) ||
      (s.chapter === 4 && s.round >= 3) ||
      (s.chapter === 6 && s.skyAligned)
    )
      return {
        state: original,
        changed: false,
        message:
          "This mechanism is complete. Follow the new lead in your objective card.",
      };
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
      if (s.chapter === 2) {
        s.archiveOpen = true;
        message =
          "Iris did not steal the Star. The music box beside the globe clicks open. It is much, much bigger on the inside.";
      } else if (s.chapter === 6) {
        s.skyAligned = true;
        s.mirrors = [0, 0];
        s.mirrorRound = 0;
        message =
          "The roof peels back like paper. Two mirror pedestals wake beneath an impossible sky.";
      } else if (s.chapter === 4 && s.round === 2) {
        s.round = 3;
        s.circuit = [...circuitInitial];
        message =
          "The third message is not a message. It is a heartbeat. Reconnect the copper circuit from the two wall panels.";
      } else if (s.chapter === 3) {
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
    (item.gate === "archive" && !state.archiveOpen) ||
    !near(pose, item.place, item.pos[0], item.pos[2])
  )
    return null;
  return item.target
    ? { place: item.target, position: places[item.target].spawn }
    : null;
}
