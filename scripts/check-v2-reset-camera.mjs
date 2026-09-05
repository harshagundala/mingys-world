import fs from "node:fs";
import assert from "node:assert/strict";
import Redis from "ioredis";
import { Browser, sleep } from "./cdp.mjs";
const a = await new Browser("mingy-a").connect(),
  b = await new Browser("mingy-b").connect(),
  redis = new Redis(process.env.REDIS_URL);
async function until(p, expression) {
  for (let i = 0; i < 120; i++) {
    const result = await p.eval(expression);
    if (result) return result;
    await sleep(100);
  }
  throw new Error("Condition timed out: " + expression);
}
async function shot(p, name) {
  const { data } = await p.call(
    "Page.captureScreenshot",
    { format: "png" },
    true,
  );
  fs.writeFileSync("output/v2/" + name + ".png", Buffer.from(data, "base64"));
}
try {
  const oldRoom = (await b.state()).snapshot.room;
  const before = await redis.get("mingy:v1:" + oldRoom);
  assert.equal(JSON.parse(before).chapter, 8);
  await a.eval(`sessionStorage.removeItem('mingy-invite')`);
  await a.call("Page.navigate", { url: "http://127.0.0.1:5173/reset" }, true);
  await until(
    a,
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Create a fresh adventure')`,
  );
  await shot(a, "reset-page");
  await a.clickText("Create a fresh adventure");
  const invitation = await a.eval(`document.querySelector('#fresh-url').value`),
    url = new URL(invitation),
    fragment = new URLSearchParams(url.hash.slice(1)),
    room = fragment.get("room");
  assert.notEqual(room, oldRoom);
  assert.equal(fragment.get("invite"), process.env.WORLD_SECRET.trim());
  assert.equal(await redis.get("mingy:v1:" + room), null);
  await a.clickText("Copy link");
  assert.equal(
    await a.eval(`document.querySelector('#fresh-url').value`),
    invitation,
  );
  for (const [i, p] of [a, b].entries()) {
    await p.call("Page.navigate", { url: invitation }, true);
    await sleep(650);
    await p.call("Page.reload", {}, true);
    await until(
      p,
      `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Join our adventure'&&!b.disabled)`,
    );
    await p.eval(`document.querySelectorAll('.avatar-option')[${i}].click()`);
    await p.clickText("Join our adventure");
    await until(
      p,
      `window.__mingy.session.snapshot.status==='connected'&&!!window.__mingyGraphics`,
    );
  }
  for (const p of [a, b]) {
    const s = (await p.state()).snapshot.state;
    assert.equal(s.chapter, 0);
    assert.equal(s.found.length, 0);
    assert.equal(s.bells.length, 0);
  }
  assert.equal(await redis.get("mingy:v1:" + oldRoom), before);
  console.log(
    "Reset: new private invitation, fresh shared case, previous completed save unchanged",
  );
  // Exercise Chromium's native getUserMedia and permission handling with its fake video device.
  await a.eval(
    `(()=>{window.__nativeCamera=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.__nativeRequests=[];navigator.mediaDevices.getUserMedia=c=>{window.__nativeRequests.push(c);return window.__nativeCamera(c);};})()`,
  );
  await a.call("Browser.setPermission", {
    permission: { name: "camera" },
    setting: "denied",
    origin: "http://127.0.0.1:5173",
  });
  await a.clickText("Enable camera");
  await until(a, `!!document.querySelector('.camera-setup-error')`);
  assert.match(
    await a.eval(`document.querySelector('.camera-setup-error').textContent`),
    /blocked/i,
  );
  await shot(a, "native-camera-denied");
  await a.call("Browser.setPermission", {
    permission: { name: "camera" },
    setting: "granted",
    origin: "http://127.0.0.1:5173",
  });
  await a.clickText("Enable camera");
  await until(
    a,
    `window.__mingy.camera.active&&document.querySelector('.camera-onboarding video').readyState>=2`,
  );
  const video = await a.eval(
    `({requests:window.__nativeRequests.map(c=>({audio:c.audio,video:!!c.video})),audioTracks:window.__mingy.camera.stream.getAudioTracks().length,videoTracks:window.__mingy.camera.stream.getVideoTracks().map(t=>({state:t.readyState,label:t.label})),error:document.querySelector('.camera-setup-error')?.textContent})`,
  );
  assert.equal(video.audioTracks, 0);
  assert.ok(video.requests.every((c) => c.audio === false && c.video));
  assert.equal(video.videoTracks[0].state, "live");
  assert.equal(video.error, undefined);
  await shot(a, "native-camera-preview");
  await a.eval(`window.__mingy.camera.disable()`);
  for (const p of [a, b]) await p.clickText("Ready, Mingy");
  console.log(
    "Native Chrome camera: denial, site permission retry, real video track and welcome preview passed",
    video,
  );
  fs.writeFileSync(
    "output/v2/reset-camera-report.json",
    JSON.stringify({ oldRoom, room, reset: "passed", camera: video }, null, 2),
  );
} finally {
  await redis.quit();
  a.close();
  b.close();
}
