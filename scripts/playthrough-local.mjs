import {
  dreamRoutes,
  dreamTile,
  dreamNavigator,
  mirrorTargets,
} from "../src/game/adventure.ts";
import { clues } from "../src/game/content.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Browser, sleep } from "./cdp.mjs";
const connections = await Promise.all(
  ["mingy-a", "mingy-b"].map((name) => new Browser(name).connect()),
);
const players = [];
for (const p of connections) players[(await p.state()).snapshot.role] = p;
const [a, b] = players;
const log = [];
const report = (name, data = {}) => {
  console.log(name, data);
  log.push({ name, ...data, time: new Date().toISOString() });
};
async function waitState(test, label = "State update") {
  for (let i = 0; i < 90; i++) {
    const s = (await a.state()).snapshot.state;
    if (test(s)) return s;
    await sleep(100);
  }
  throw new Error(label + " timed out");
}
async function route(p, points) {
  await p.press("Escape");
  for (const [x, z] of points) await p.move(x, z);
  await sleep(180);
}
async function open(p, expected) {
  await p.press("KeyE");
  await sleep(200);
  const title = await p.eval(
    `document.querySelector('#panel-title')?.textContent`,
  );
  assert.equal(title, expected);
}
async function read(p, points, title) {
  const clue = clues.find((c) => c.title === title);
  if ((await p.state()).snapshot.state.found.includes(clue.id)) return;
  await route(p, points);
  await open(p, title);
  await sleep(180);
  await p.press("Escape");
}
async function collectFuse(p, id, points) {
  if ((await p.state()).snapshot.state.fuses.includes(id)) return;
  await route(p, points);
  for (let attempt = 0; attempt < 4; attempt++) {
    await p.press("Escape");
    if (attempt) {
      await p.press("Space");
      await p.move(...points.at(-1));
    }
    for (let i = 0; i < 8; i++) {
      if (
        await p.eval(
          `document.querySelector('.interaction-prompt')?.textContent.includes('Restore your fuse')`,
        )
      )
        break;
      await sleep(100);
    }
    if (
      await p.eval(
        `document.querySelector('.interaction-prompt')?.textContent.includes('Restore your fuse')`,
      )
    )
      await p.press("KeyE");
    for (let i = 0; i < 15; i++) {
      if ((await p.state()).snapshot.state.fuses.includes(id)) return;
      await sleep(100);
    }
  }
  assert.fail("Fuse not collected: " + id);
}
async function chapter(n) {
  for (let i = 0; i < 70; i++) {
    if (
      (await a.state()).snapshot.state?.chapter === n &&
      (await b.state()).snapshot.state?.chapter === n
    )
      break;
    await sleep(100);
  }
  assert.equal((await a.state()).snapshot.state.chapter, n);
  assert.equal((await b.state()).snapshot.state.chapter, n);
  const shared = await Promise.all(players.map((p) => p.state()));
  assert.deepEqual(shared[0].snapshot.state, shared[1].snapshot.state);
  for (const p of players) await p.press("Escape");
  await sleep(250);
  report("Chapter synchronized", { chapter: n });
}
async function travel(p, points, place) {
  await route(p, points);
  await p.press("KeyE");
  for (let i = 0; i < 50; i++) {
    if ((await p.state()).snapshot.place === place) break;
    await sleep(100);
  }
  assert.equal((await p.state()).snapshot.place, place);
  await sleep(450);
}
async function sequence(p, values, label) {
  for (const v of values) {
    await p.eval(
      `(()=>{const b=[...document.querySelectorAll('.symbol-option')].find(b=>b.textContent.trim()===${JSON.stringify(v)});if(!b)throw new Error('Symbol missing');b.click();})()`,
    );
    await sleep(65);
  }
  await p.clickText(label);
  await sleep(700);
}
async function screen(p, name) {
  const { data } = await p.call(
    "Page.captureScreenshot",
    { format: "png" },
    true,
  );
  fs.writeFileSync(
    `output/playwright/${name}.png`,
    Buffer.from(data, "base64"),
  );
}
try {
  let start = (await a.state()).snapshot.state.chapter;
  if (start === 0) {
    await route(a, [[1.2, 6.5]]);
    await open(a, "The brass arrival bell");
    await a.clickText("Ring the bell");
    await a.press("Escape");
    await route(b, [[1.4, 6.5]]);
    await open(b, "The brass arrival bell");
    await b.clickText("Ring the bell");
    await chapter(1);
  }
  if ((await a.state()).snapshot.state.chapter === 1) {
    await Promise.all([
      read(
        a,
        [
          [-2.2, 6.8],
          [-2.2, 4.8],
          [-5, 4.8],
          [-6, 5.4],
          [-8, 5.4],
        ],
        "A photograph turned around",
      ),
      read(
        b,
        [
          [2, 6.9],
          [2, 5],
          [5, 5],
          [8, 5.1],
        ],
        "A cooling cup of tea",
      ),
    ]);
    await Promise.all([
      read(
        a,
        [
          [-5, 5.4],
          [-5, -4],
          [-6, -4],
          [-6.5, -7],
          [-7.0, -7],
        ],
        "The watchmaker’s margin",
      ),
      read(
        b,
        [
          [5, 5.1],
          [4.5, -4],
          [7, -4.6],
        ],
        "The departure slip",
      ),
    ]);
    await route(a, [
      [-6, -7],
      [-6, -4],
      [0, -4],
      [-1.3, -7.8],
    ]);
    await open(a, "The grandfather clock");
    await a.eval(`document.querySelector('#clock-code').focus()`);
    await a.call("Input.insertText", { text: "2140" }, true);
    await a.clickText("Turn the key");
    await chapter(2);
    report("All four house traces collected and clock solved");
  }
  if ((await a.state()).snapshot.state.chapter === 2) {
    await travel(
      a,
      [
        [0, -4],
        [4.7, -4],
        [10, -4],
        [10, -9],
      ],
      "loft",
    );
    await travel(
      b,
      [
        [10, -7],
        [10, -9],
      ],
      "loft",
    );
    await Promise.all([
      read(
        a,
        [
          [0, 5.5],
          [-8, 5.5],
        ],
        "The guest book",
      ),
      read(
        b,
        [
          [0, 5.5],
          [8, 5.5],
        ],
        "The piano tuner’s statement",
      ),
    ]);
    await Promise.all([
      read(
        a,
        [
          [-5.5, 5.5],
          [-5.5, -2.7],
          [-8, -2.7],
        ],
        "A misplaced dinner card",
      ),
      read(
        b,
        [
          [5.5, 5.5],
          [5.5, -2.7],
          [8, -2.7],
        ],
        "Copper on the windowsill",
      ),
    ]);
    await read(
      a,
      [
        [-5, -2.7],
        [-5, -6.7],
        [0, -6.7],
      ],
      "A sealed maintenance request",
    );
    await route(a, [
      [-3, -6.7],
      [-3, 3],
      [0, 3],
      [0, 2.2],
    ]);
    await open(a, "The evidence desk");
    await a.eval(
      `(()=>{const selects=[...document.querySelectorAll('.guest-grid select')];const values=['Vale','21:10','Ada','20:40','Pip','21:25','Iris','20:55'];selects.forEach((el,i)=>{el.value=values[i];el.dispatchEvent(new Event('change',{bubbles:true}));});})()`,
    );
    await screen(a, "library-deduction");
    await a.clickText("Reconstruct the evening");
    await waitState((s) => s.archiveOpen, "Music box opens");
    for (const p of players)
      await travel(
        p,
        [
          [6, 1],
          [6, -1],
        ],
        "dream",
      );
    await Promise.all([
      read(a, [[5.7, 4]], "The tea is getting rather large"),
      read(b, [[-8, -3.5]], "The architecture of missing someone"),
    ]);
    await read(
      a,
      [
        [5, -1],
        [8, -4],
      ],
      "An astronomer in a paper boat",
    );
    await screen(a, "impossible-garden");
    for (let round = 0; round < 3; round++) {
      const nav = players[dreamNavigator(round)],
        runner = players[1 - dreamNavigator(round)];
      await route(nav, [
        [-5, 6.5],
        [-8, 6.4],
      ]);
      await open(nav, "The atlas of rooms that cannot exist");
      await runner.press("Escape");
      for (const [step, tile] of dreamRoutes[round].entries()) {
        const { x, z } = dreamTile(tile);
        await runner.move(x, z);
        await sleep(220);
        await runner.press("KeyE");
        await waitState(
          (s) => (s.dreamRound || 0) > round || (s.dreamStep || 0) > step,
          "Dream tile " + tile,
        );
      }
      report("Folded atlas walked by correct collar", { round: round + 1 });
    }
    await chapter(3);
    for (const p of players)
      await travel(
        p,
        [
          [0, 6],
          [0, 9.2],
        ],
        "loft",
      );
  }
  if ((await a.state()).snapshot.state.chapter === 3) {
    await travel(
      a,
      [
        [0, 5.5],
        [0, 9.4],
      ],
      "house",
    );
    await travel(
      b,
      [
        [5, 0],
        [5, 5.5],
        [0, 5.5],
        [0, 9.4],
      ],
      "house",
    );
    for (const p of players)
      await travel(
        p,
        [
          [2, 8],
          [2, 3],
          [1, -4],
          [0, -10.1],
        ],
        "garden",
      );
    await Promise.all([
      read(
        a,
        [
          [-3, 8],
          [-5.3, 7],
          [-5.4, 5],
        ],
        "The gardener’s arrangement",
      ),
      read(
        b,
        [
          [3, 8],
          [5.3, 7],
          [5.4, 5],
        ],
        "An instruction under the watering can",
      ),
    ]);
    await Promise.all([
      read(
        a,
        [
          [-5.4, 1],
          [-8, 1],
          [-8, -2.8],
        ],
        "The sun bed",
      ),
      read(
        b,
        [
          [5.4, 1],
          [8, 1],
          [8, -2.8],
        ],
        "The moon bed",
      ),
    ]);
    await route(a, [
      [-4.9, -2.8],
      [-4.9, -4],
      [0, -4],
      [0, -5.7],
    ]);
    await open(a, "The irrigation cabinet");
    await sequence(a, ["fern", "rose", "lily", "ivy"], "Open the valves");
    await a.press("Escape");
    await Promise.all([
      route(a, [[-3, -4]]),
      route(b, [
        [4.9, -2.8],
        [3, -4],
      ]),
    ]);
    await screen(a, "garden-two-seals");
    await chapter(4);
  }
  if ((await a.state()).snapshot.state.chapter === 4) {
    for (const p of players)
      if ((await p.state()).snapshot.place !== "lab")
        await travel(
          p,
          [
            [2, -4],
            [2, -8.5],
            [0, -9.4],
          ],
          "lab",
        );
    await Promise.all([
      read(
        a,
        [
          [0, 6.5],
          [-8, 6.5],
        ],
        "The workshop journal",
      ),
      read(
        b,
        [
          [0, 6.5],
          [8, 6.5],
        ],
        "The transmitter manual",
      ),
    ]);
    await read(
      a,
      [
        [-6, 6.5],
        [-6, -3.5],
        [-8, -3.5],
      ],
      "A note about the backup power",
    );
    await route(a, [
      [-6, -3.5],
      [0, -3.5],
      [0, -4.8],
    ]);
    await open(a, "The signal console");
    await route(b, [
      [6, 6.5],
      [6, 2.5],
      [2, 2.5],
      [2, -3.5],
      [0.7, -4.8],
    ]);
    await open(b, "The signal console");
    const transmissions = [
      ["paw", "moon", "star", "sun"],
      ["sun", "star", "moon", "paw", "sun"],
      ["star", "paw", "sun", "moon", "star", "sun"],
    ];
    while (
      (await b.state()).snapshot.state.chapter === 4 &&
      (await b.state()).snapshot.state.round < 3
    ) {
      const round = (await b.state()).snapshot.state.round;
      await b.clickText("Clear");
      await sleep(100);
      await sequence(b, transmissions[round], "Send the reply");
      for (let i = 0; i < 60; i++) {
        const state = (await b.state()).snapshot.state;
        if (state.round !== round || state.chapter !== 4) break;
        await sleep(100);
      }
      const next = (await b.state()).snapshot.state;
      assert.ok(
        next.round !== round || next.chapter !== 4,
        "Transmission did not advance",
      );
    }
    await waitState((s) => s.round === 3, "Transmissions complete");
    await Promise.all([route(a, [[-8, -3.7]]), route(b, [[8, -3.7]])]);
    await open(a, "The mint circuit panel");
    await open(b, "The rose circuit panel");
    await screen(a, "copper-circuit");
    for (let i = 0; i < 16; i++) {
      const owner = (Math.floor(i / 4) + (i % 4)) % 2,
        p = players[owner];
      for (let turn = 0; turn < 4; turn++) {
        const s = (await a.state()).snapshot.state;
        if (s.chapter === 5 || s.circuit[i] === 0) break;
        const previous = s.circuit[i];
        await p.eval(
          `document.querySelector('[aria-label="Turn pipe ${i + 1}"]').click()`,
        );
        await waitState(
          (s) => s.chapter === 5 || s.circuit[i] !== previous,
          "Copper pipe " + i,
        );
      }
    }
    await chapter(5);
    report(
      "Three asymmetric transmissions and shared copper circuit completed",
    );
  }
  if ((await a.state()).snapshot.state.chapter === 5) {
    await route(a, [
      [3, -3],
      [5, -6],
    ]);
    await open(a, "The backup power console");
    await a.clickText("Start the backup run");
    for (
      let i = 0;
      i < 50 && ((await a.state()).snapshot.state.powerUntil || 0) < Date.now();
      i++
    )
      await sleep(100);
    await a.press("Escape");
    await Promise.all([
      (async () => {
        for (const [id, points] of [
          ["f2", [[3, -8]]],
          [
            "f1",
            [
              [-3, -8],
              [-5.8, -8],
              [-5.8, -3.5],
              [-8, -3.5],
            ],
          ],
          [
            "f0",
            [
              [-6, -3.5],
              [-6, 6.5],
              [-9, 6.5],
            ],
          ],
        ]) {
          await collectFuse(a, id, points);
        }
      })(),
      (async () => {
        for (const [id, points] of [
          [
            "f5",
            [
              [-3, -3.5],
              [-3, -8],
            ],
          ],
          [
            "f4",
            [
              [3, -8],
              [5.7, -8],
              [5.7, -3],
              [8, -3],
            ],
          ],
          [
            "f3",
            [
              [5.7, -3],
              [5.7, 6.5],
              [9, 6.5],
            ],
          ],
        ]) {
          await collectFuse(b, id, points);
        }
      })(),
    ]);
    await chapter(6);
    report("Timed cooperative power run completed");
  }
  if ((await a.state()).snapshot.state.chapter === 6) {
    for (const [p, x] of [
      [a, -5.8],
      [b, 5.8],
    ])
      await travel(
        p,
        [
          [x, 6.5],
          [x, -8],
          [0, -9.4],
        ],
        "observatory",
      );
    await Promise.all([
      read(
        a,
        [
          [0, 5.5],
          [-8, 5.5],
        ],
        "The west window",
      ),
      read(
        b,
        [
          [0, 5.5],
          [8, 5.5],
        ],
        "The east window",
      ),
    ]);
    await Promise.all([
      read(
        a,
        [
          [-5.5, 5.5],
          [-5.5, -3.5],
          [-7, -3.5],
        ],
        "The astronomer’s definition",
      ),
      read(
        b,
        [
          [8, 1],
          [8, -3.5],
          [7, -3.5],
        ],
        "A letter never sent",
      ),
    ]);
    await read(
      a,
      [
        [-4, -3.5],
        [-4, -7],
        [0, -7],
      ],
      "The Caretaker’s final field note",
    );
    await route(a, [
      [-3, -7],
      [-3, 1],
      [0, 1],
      [0, 0],
    ]);
    await open(a, "The celestial orrery");
    await screen(a, "observatory-puzzle");
    await sequence(a, ["moon", "comet", "sun", "paw", "key"], "Align the sky");
    await waitState((s) => s.skyAligned, "Sky alignment");
    await Promise.all([route(a, [[-6, 1.05]]), route(b, [[6, 1.05]])]);
    await open(a, "The western mirror");
    await open(b, "The eastern mirror");
    await screen(a, "linked-mirrors");
    for (let round = 0; round < 3; round++) {
      const s = (await a.state()).snapshot.state,
        angles = s.mirrors || [0, 0],
        target = mirrorTargets[round];
      let turns;
      for (let i = 0; i < 12; i++)
        for (let j = 0; j < 12; j++)
          if (
            (angles[0] + i + j * 3) % 12 === target[0] &&
            (angles[1] + i * 2 + j) % 12 === target[1]
          )
            turns = [i, j];
      assert.ok(turns, "Linked mirrors reachable");
      for (const [r, count] of turns.entries())
        for (let i = 0; i < count; i++) {
          const before = JSON.stringify(
            (await a.state()).snapshot.state.mirrors,
          );
          await players[r].clickText("One step forward");
          await waitState(
            (s) => JSON.stringify(s.mirrors) !== before,
            "Mirror rotation",
          );
        }
      await Promise.all(players.map((p) => p.clickText("Hold my reflection")));
      await waitState(
        (s) => (s.mirrorRound || 0) > round || s.chapter === 7,
        "Constellation held",
      );
      report("Both collars held linked constellation", { round: round + 1 });
    }
    await chapter(7);
  }
  if ((await a.state()).snapshot.state.chapter === 7) {
    await travel(a, [[0, 6]], "house");
    await travel(
      b,
      [
        [8, 5.5],
        [0, 6],
      ],
      "house",
    );
    await Promise.all([
      route(a, [
        [-1.7, 8],
        [-1.7, 3],
        [-0.7, 0.8],
      ]),
      route(b, [
        [1.8, 8],
        [1.8, 3],
        [0.7, 0.8],
      ]),
    ]);
    await open(a, "The heart of the house");
    await open(b, "The heart of the house");
    await Promise.all(
      players.map((p) => p.clickText("Put my paw beside yours")),
    );
    await chapter(8);
    await sleep(2200);
    await screen(a, "ending");
    assert.ok(
      await a.eval(
        `document.querySelector('.memory-carousel img').naturalWidth>0`,
      ),
    );
    for (let i = 0; i < 30; i++) {
      await a.eval(
        `document.querySelector('[aria-label="Next memory"]').click()`,
      );
      const expected = (i + 1) % 30;
      for (const p of players) {
        for (
          let n = 0;
          n < 80 && (await p.state()).snapshot.state.galleryIndex !== expected;
          n++
        )
          await sleep(100);
        assert.equal((await p.state()).snapshot.state.galleryIndex, expected);
      }
    }
    report(
      "Both players reached ending and all 30 shared carousel positions visited",
    );
  }
  fs.writeFileSync(
    "output/playthrough-report.json",
    JSON.stringify(log, null, 2),
  );
} finally {
  for (const p of players) {
    await p
      .eval(
        "(()=>{window.__mingy.controls.keys.clear();window.__mingy.controls.touch={x:0,z:0};})()",
      )
      .catch(() => {});
    p.close();
  }
}
