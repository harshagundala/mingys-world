import assert from "node:assert/strict";
import fs from "node:fs";
import { Browser, sleep } from "./cdp.mjs";
const players = [
  await new Browser("mingy-a").connect(),
  await new Browser("mingy-b").connect(),
];
try {
  for (let i = 0; i < 30; i++) {
    const p = players[i % 2];
    await p.eval(
      `document.querySelector('[aria-label="View memory ${i + 1}"]').click()`,
    );
    for (const other of players) {
      for (let n = 0; n < 100; n++) {
        if (
          await other.eval(
            `document.querySelector('.memory-carousel img')?.getAttribute('src')==='/api/photo?id=${i}'&&document.querySelector('.memory-carousel img').naturalWidth>0`,
          )
        )
          break;
        await sleep(100);
      }
      assert.equal(
        await other.eval(
          `document.querySelector('.memory-carousel img').getAttribute('src')`,
        ),
        "/api/photo?id=" + i,
      );
      assert.ok(
        await other.eval(
          `document.querySelector('.memory-carousel img').naturalWidth>0`,
        ),
      );
    }
  }
  const { data } = await players[0].call(
    "Page.captureScreenshot",
    { format: "png" },
    true,
  );
  fs.writeFileSync(
    "output/playwright/ending-shared-album.png",
    Buffer.from(data, "base64"),
  );
  console.log(
    "All 30 full photos loaded on both screens, alternating shared controls: passed",
  );
  await sleep(16000);
  for (const p of players)
    assert.equal(
      await p.eval(
        'window.__qa ? window.__qa.peers.at(-1)?.connectionState === "connected" : window.__mingy.session.snapshot.otherOnline',
      ),
      true,
    );
  console.log(
    "Ending keeps partner presence alive while the 3D world is unmounted: passed",
  );
} finally {
  players.forEach((p) => p.close());
}
