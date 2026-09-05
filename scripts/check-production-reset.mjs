import assert from "node:assert/strict";
import fs from "node:fs";
import Redis from "ioredis";
import { Browser, sleep } from "./cdp.mjs";
const origin = "https://mingys-world.vercel.app",
  a = await new Browser("mingy-a").connect(),
  b = await new Browser("mingy-b").connect(),
  redis = new Redis(process.env.REDIS_URL);
async function until(p, expression) {
  for (let i = 0; i < 120; i++) {
    try {
      if (await p.eval(expression)) return;
    } catch {}
    await sleep(150);
  }
  throw new Error("Condition timed out: " + expression);
}
try {
  for (const [i, p] of [a, b].entries())
    await p.call(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `
window.__qa={cameraRequests:[]};const WS=window.WebSocket;window.WebSocket=class extends WS{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.state)window.__qa.state=m.state;}catch{}});}};
navigator.mediaDevices.getUserMedia=async constraints=>{window.__qa.cameraRequests.push(constraints);const c=document.createElement('canvas');c.width=320;c.height=240;let n=0;setInterval(()=>{const x=c.getContext('2d');x.fillStyle='${i ? "#9c687b" : "#487d66"}';x.fillRect(0,0,320,240);x.fillStyle='#fff';x.font='25px sans-serif';x.fillText('Mingy',90,110);x.fillRect((n++*7)%300,150,20,20);},80);return c.captureStream(12);};
`,
      },
      true,
    );
  const oldRoom = await b.eval(
      `new URLSearchParams(location.hash.slice(1)).get('room')`,
    ),
    before = await redis.get("mingy:v1:" + oldRoom);
  assert.equal(JSON.parse(before).chapter, 1);
  await a.call(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: `window.__qaSound=[];const Audio=window.AudioContext;window.AudioContext=class extends Audio{constructor(...args){super(...args);this.qaGains=[];window.__qaSound.push(this);}createGain(){const g=super.createGain();this.qaGains.push(g);return g;}};`,
    },
    true,
  );
  await a.call("Page.navigate", { url: origin + "/reset" }, true);
  await sleep(650);
  await until(
    a,
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Create a fresh adventure')`,
  );
  await a.clickText("Create a fresh adventure");
  const invitation = await a.eval(`document.querySelector('#fresh-url').value`),
    hash = new URLSearchParams(new URL(invitation).hash.slice(1)),
    room = hash.get("room");
  assert.notEqual(room, oldRoom);
  assert.equal(hash.get("invite"), process.env.WORLD_SECRET.trim());
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
    await until(p, `window.__qa.state?.chapter===0`);
  }
  await until(
    a,
    `document.querySelector('.camera-onboarding button')?.textContent.trim()==='Enable camera'`,
  );
  await a.eval(
    `(()=>{window.__cameraSuccess=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('test blocked','NotAllowedError')};})()`,
  );
  await a.clickText("Enable camera");
  await until(a, `!!document.querySelector('.camera-setup-error')`);
  await a.eval(`navigator.mediaDevices.getUserMedia=window.__cameraSuccess`);
  await a.clickText("Enable camera");
  await until(
    a,
    `document.querySelector('.camera-onboarding video').readyState>=2&&!document.querySelector('.camera-setup-error')`,
  );
  const { data } = await a.call(
    "Page.captureScreenshot",
    { format: "png" },
    true,
  );
  fs.writeFileSync(
    "output/v2/production-camera-welcome.png",
    Buffer.from(data, "base64"),
  );
  for (const p of [a, b]) await p.clickText("Ready, Mingy");
  const initial = JSON.parse(await redis.get("mingy:v1:" + room));
  assert.equal(initial.chapter, 0);
  assert.deepEqual(initial.found, []);
  assert.deepEqual(initial.bells, []);
  assert.equal(await redis.get("mingy:v1:" + oldRoom), before);
  await a.eval(
    `document.querySelector('[aria-label="Mute soundtrack"]').click()`,
  );
  await sleep(1600);
  const quiet = await a.eval(`window.__qaSound[0].qaGains[0].gain.value`);
  assert.ok(quiet < 0.001);
  await a.eval(
    `document.querySelector('[aria-label="Play original soundtrack"]').click()`,
  );
  await sleep(1200);
  const audible = await a.eval(`window.__qaSound[0].qaGains[0].gain.value`);
  assert.ok(audible > 0.3);
  const result = {
    reset: "fresh two-player case; previous save unchanged",
    onboarding: "blocked-camera feedback and successful video preview",
    soundtrack: { mutedGain: quiet, playingGain: audible },
    microphoneRequested: await a.eval(
      `window.__qa.cameraRequests.some(c=>c.audio!==false)`,
    ),
  };
  assert.equal(result.microphoneRequested, false);
  fs.writeFileSync(
    "output/v2/production-reset-report.json",
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} finally {
  await redis.quit();
  a.close();
  b.close();
}
