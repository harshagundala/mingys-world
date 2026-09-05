import {
  dreamRoutes,
  dreamNavigator,
  dreamTile,
  circuitSolved,
  circuitInitial,
  mirrorTargets,
} from "../src/game/adventure.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reduceAction, travelTarget } from "../server/rules.ts";
import { clues, required, signalCodes, decoder } from "../src/game/content.ts";
const pos = (place, x, z, time = 100000) => ({
  place,
  x,
  y: 0,
  z,
  rot: 0,
  moving: false,
  time,
});
const at = (id, role = 0) => {
  const c = clues.find((c) => c.id === id);
  return { [role]: pos(c.place, c.pos[0], c.pos[2]) };
};
const prepared = (chapter) => ({
  ...initialState(),
  chapter,
  found: required[chapter] || [],
});
const act = (s, role, a, p, now = 100000) => reduceAction(s, role, a, p, now);
test("only two separate arrivals start the mystery, and bell is distance checked", () => {
  let s = initialState();
  s = act(s, 0, { kind: "bell" }, at("bell")).state;
  assert.equal(s.chapter, 0);
  s = act(s, 0, { kind: "bell" }, at("bell")).state;
  assert.equal(s.chapter, 0);
  assert.equal(
    act(s, 1, { kind: "bell" }, { 1: pos("loft", 1, 5) }).state.chapter,
    0,
  );
  assert.equal(act(s, 1, { kind: "bell" }, at("bell", 1)).state.chapter, 1);
});
test("clue collection is idempotent, nearby, stage and location gated", () => {
  let s = prepared(1);
  s.found = [];
  assert.equal(
    act(s, 0, { kind: "read", id: "guest-a" }, at("guest-a")).changed,
    false,
  );
  s = act(s, 0, { kind: "read", id: "clock-a" }, at("clock-a")).state;
  assert.equal(s.found.length, 1);
  assert.equal(
    act(s, 0, { kind: "read", id: "clock-a" }, at("clock-a")).changed,
    false,
  );
  assert.equal(
    act(s, 0, { kind: "read", id: "clock-b" }, { 0: pos("garden", 8, 3) })
      .changed,
    false,
  );
});
test("answers cannot skip missing clues, wrong chapter, or proximity", () => {
  const s = prepared(1);
  s.found = [];
  assert.equal(
    act(s, 0, { kind: "solve", id: "clock", answer: "2140" }, at("clock")).state
      .chapter,
    1,
  );
  s.found = required[1];
  assert.equal(
    act(
      s,
      0,
      {
        kind: "solve",
        id: "sky",
        answer: ["moon", "comet", "sun", "paw", "key"],
      },
      at("sky"),
    ).state.chapter,
    1,
  );
  assert.equal(
    act(s, 0, { kind: "solve", id: "clock", answer: "2140" }, at("clock-a"))
      .state.chapter,
    1,
  );
  assert.equal(
    act(s, 0, { kind: "solve", id: "clock", answer: "2140" }, at("clock")).state
      .chapter,
    2,
  );
});
test("deduction admits exactly one assignment under every written timing constraint", () => {
  const perms = (a) =>
    a.length
      ? a.flatMap((x, i) =>
          perms(a.filter((_, n) => n !== i)).map((p) => [x, ...p]),
        )
      : [[]];
  let solutions = [];
  for (const guests of perms(["Iris", "Vale", "Pip", "Ada"]))
    for (const times of perms([0, 15, 30, 45])) {
      const guestTime = (n) => times[guests.indexOf(n)];
      if (
        times[1] !== 0 ||
        guestTime("Iris") !== times[1] + 15 ||
        guestTime("Pip") !== guestTime("Iris") + 30 ||
        !(
          guestTime("Vale") > guestTime("Iris") &&
          guestTime("Vale") < guestTime("Pip")
        ) ||
        times[0] !== times[2] - 15 ||
        times[3] >= times[0] ||
        guests[3] === "Ada"
      )
        continue;
      solutions.push({ guests, times });
    }
  assert.deepEqual(solutions, [
    { guests: ["Vale", "Ada", "Pip", "Iris"], times: [30, 0, 45, 15] },
  ]);
  assert.equal(
    act(
      prepared(2),
      0,
      {
        kind: "solve",
        id: "evidence",
        answer: {
          guests: solutions[0].guests,
          times: ["21:10", "20:40", "21:25", "20:55"],
        },
      },
      at("evidence"),
    ).state.archiveOpen,
    true,
  );
});

test("garden requires correct sequence then two fresh separate occupied plates continuously", () => {
  let s = act(
    prepared(3),
    0,
    { kind: "solve", id: "valves", answer: ["fern", "rose", "lily", "ivy"] },
    at("valves"),
  ).state;
  assert.equal(s.water, true);
  assert.equal(s.chapter, 3);
  const p = { 0: pos("garden", -3, -4), 1: pos("garden", 3, -4) };
  s = act(s, 0, { kind: "plate" }, p).state;
  assert.equal(s.plateSince, 100000);
  assert.equal(act(s, 0, { kind: "plate" }, p, 102000).state.chapter, 3);
  let broke = act(
    s,
    0,
    { kind: "plate" },
    { ...p, 1: pos("garden", 5, -4) },
    102500,
  ).state;
  assert.equal(broke.plateSince, null);
  assert.equal(act(s, 1, { kind: "plate" }, p, 103000).state.chapter, 4);
  assert.equal(
    act(
      s,
      0,
      { kind: "plate" },
      { ...p, 1: pos("garden", 3, -4, 80000) },
      103000,
    ).state.chapter,
    3,
  );
});
test("only receiver answers transmissions; wrong attempts retain the current round", () => {
  let s = prepared(4);
  for (let i = 0; i < 3; i++) {
    const answer = signalCodes[i].map((n) => decoder[n]);
    assert.equal(
      act(s, 0, { kind: "solve", id: "signal", answer }, at("signal")).state
        .round,
      i,
    );
    const wrong = act(
      s,
      1,
      { kind: "solve", id: "signal", answer: ["sun"] },
      at("signal", 1),
    ).state;
    assert.equal(wrong.round, i);
    s = act(
      s,
      1,
      { kind: "solve", id: "signal", answer },
      at("signal", 1),
    ).state;
  }
  assert.equal(s.chapter, 4);
  assert.equal(s.round, 3);
});
test("power run can retry without losing investigation, needs both and enforces fuse role and deadline", () => {
  let s = prepared(5);
  assert.equal(
    act(s, 0, { kind: "power-start" }, at("power")).state.powerUntil,
    null,
  );
  s = act(
    s,
    0,
    { kind: "power-start" },
    { ...at("power"), 1: pos("lab", 0, 8) },
  ).state;
  assert.equal(s.powerUntil, 200000);
  assert.equal(
    act(s, 1, { kind: "fuse", id: "f0" }, { 1: pos("lab", -9, 5) }).state.fuses
      .length,
    0,
  );
  assert.equal(
    act(s, 0, { kind: "fuse", id: "f0" }, { 0: pos("lab", -9, 5) }, 200001)
      .state.fuses.length,
    0,
  );
  const retry = act(
    s,
    0,
    { kind: "power-start" },
    { 0: pos("lab", 7, -6, 201000), 1: pos("lab", 0, 8, 201000) },
    201000,
  ).state;
  assert.equal(retry.powerUntil, 301000);
  assert.deepEqual(retry.found, s.found);
});
test("finale needs two nearby distinct paws within the co-op window", () => {
  let s = prepared(7);
  const p = { 0: pos("house", 0, 0), 1: pos("house", 0, 1) };
  s = act(s, 0, { kind: "final" }, p).state;
  assert.equal(s.chapter, 7);
  assert.equal(act(s, 0, { kind: "final" }, p).state.chapter, 7);
  assert.equal(act(s, 1, { kind: "final" }, p, 109000).state.chapter, 7);
  const done = act(s, 1, { kind: "final" }, p, 101000).state;
  assert.equal(done.chapter, 8);
  assert.equal(done.finished, 101000);
});
test("portals are chapter gated and must be physically reached", () => {
  assert.equal(travelTarget(prepared(1), pos("house", 10, -9), "stairs"), null);
  assert.equal(
    travelTarget(prepared(2), pos("house", 10, -9), "stairs").place,
    "loft",
  );
  assert.equal(
    travelTarget(prepared(2), pos("garden", 10, -9), "stairs"),
    null,
  );
});
test("all photo references exist and every required trace has reachable chapter metadata", () => {
  for (const c of clues) {
    if (c.kind === "photo") assert.ok(c.photo >= 0 && c.photo < 30, c.id);
    if (c.kind === "portal") assert.ok(c.target);
  }
  for (const [chapter, ids] of Object.entries(required)) {
    for (const id of ids)
      assert.equal(clues.find((c) => c.id === id)?.chapter, Number(chapter));
  }
});

test("the shared album unlocks at the ending and preserves its page without changing the case", () => {
  const locked = prepared(7);
  assert.equal(act(locked, 0, { kind: "memory", index: 5 }, {}).changed, false);
  const done = prepared(8);
  const next = act(done, 1, { kind: "memory", index: 29 }, {}).state;
  assert.equal(next.galleryIndex, 29);
  assert.equal(next.chapter, 8);
  assert.equal(act(next, 0, { kind: "memory", index: 30 }, {}).changed, false);
});

test("folded atlas requires evidence, a present reader and alternating distinct runners; errors only reset the current fold", () => {
  let s = { ...prepared(2), archiveOpen: true };
  let p = {
    0: pos("dream", -8, 6.4),
    1: pos("dream", dreamTile(20).x, dreamTile(20).z),
  };
  assert.equal(act(s, 1, { kind: "dream-step", tile: 20 }, p).changed, false);
  s.found.push("dream-a", "dream-b", "dream-c");
  assert.equal(act(s, 0, { kind: "dream-step", tile: 20 }, p).changed, false);
  for (let round = 0; round < 3; round++) {
    const nav = dreamNavigator(round),
      runner = 1 - nav;
    p[nav] = pos("dream", -8, 6.4);
    for (const tile of dreamRoutes[round]) {
      const t = dreamTile(tile);
      p[runner] = pos("dream", t.x, t.z);
      s = act(s, runner, { kind: "dream-step", tile }, p).state;
    }
    assert.equal(s.dreamRound, round + 1);
    assert.equal(s.dreamStep, 0);
  }
  assert.equal(s.chapter, 3);
  const halfway = {
    ...prepared(2),
    archiveOpen: true,
    dreamRound: 1,
    dreamStep: 2,
    found: ["dream-a", "dream-b", "dream-c"],
  };
  const wrong = {
    0: pos("dream", dreamTile(20).x, dreamTile(20).z),
    1: pos("dream", -8, 6.4),
  };
  const reset = act(halfway, 0, { kind: "dream-step", tile: 20 }, wrong).state;
  assert.equal(reset.dreamRound, 1);
  assert.equal(reset.dreamStep, 0);
  assert.deepEqual(reset.found, halfway.found);
  assert.equal(
    travelTarget(prepared(2), pos("loft", 6, -1), "music-box"),
    null,
  );
});
test("copper circuit traces the complete physical path and enforces ownership and proximity", () => {
  assert.equal(circuitSolved(new Array(16).fill(0)), true);
  assert.equal(circuitSolved(circuitInitial), false);
  let s = { ...prepared(4), round: 3, circuit: [...circuitInitial] };
  const p = { 0: pos("lab", -8, -3.7), 1: pos("lab", 8, -3.7) };
  assert.equal(act(s, 1, { kind: "circuit-turn", cell: 0 }, p).changed, false);
  assert.equal(
    act(s, 0, { kind: "circuit-turn", cell: 0 }, { 0: pos("house", -8, -3.7) })
      .changed,
    false,
  );
  for (let cell = 0; cell < 16; cell++) {
    const owner = (Math.floor(cell / 4) + (cell % 4)) % 2;
    for (let n = 0; n < (4 - circuitInitial[cell]) % 4; n++)
      s = act(s, owner, { kind: "circuit-turn", cell }, p).state;
  }
  assert.equal(s.chapter, 5);
  assert.equal(circuitSolved(s.circuit), true);
});
test("linked mirrors can reach every target, need both nearby holds and never erase an earlier constellation", () => {
  let s = { ...prepared(6), skyAligned: true, mirrors: [0, 0], mirrorRound: 0 };
  const p = { 0: pos("observatory", -6, 0), 1: pos("observatory", 6, 0) };
  const reachable = new Set();
  for (let a = 0; a < 12; a++)
    for (let b = 0; b < 12; b++)
      reachable.add(`${(a + 3 * b) % 12},${(2 * a + b) % 12}`);
  assert.equal(reachable.size, 144);
  assert.equal(act(s, 0, { kind: "mirror-hold" }, p).changed, false);
  for (const [round, target] of mirrorTargets.entries()) {
    let turns;
    for (let a = 0; a < 12; a++)
      for (let b = 0; b < 12; b++)
        if (
          (s.mirrors[0] + a + 3 * b) % 12 === target[0] &&
          (s.mirrors[1] + 2 * a + b) % 12 === target[1]
        )
          turns = [a, b];
    for (let role = 0; role < 2; role++)
      for (let n = 0; n < turns[role]; n++)
        s = act(s, role, { kind: "mirror-turn", direction: 1 }, p).state;
    s = act(s, 0, { kind: "mirror-hold" }, p).state;
    assert.equal(s.mirrorRound, round);
    s = act(s, 1, { kind: "mirror-hold" }, p).state;
    assert.equal(s.mirrorRound, round + 1);
  }
  assert.equal(s.chapter, 7);
});
