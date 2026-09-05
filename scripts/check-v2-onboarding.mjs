import assert from "node:assert/strict";
import fs from "node:fs";
import { Browser, sleep } from "./cdp.mjs";
const a = await new Browser("mingy-a").connect(),
  b = await new Browser("mingy-b").connect(),
  players = [a, b];
async function shot(p, name) {
  const { data } = await p.call(
    "Page.captureScreenshot",
    { format: "png" },
    true,
  );
  fs.writeFileSync("output/v2/" + name + ".png", Buffer.from(data, "base64"));
}
try {
  const room = crypto.randomUUID().replaceAll("-", "");
  for (const p of players) {
    await p.eval(
      `(()=>{window.__mingy?.camera.disable();window.__mingy?.session.leave();history.replaceState(null,'','/#room=${room}');location.reload();})()`,
    );
  }
  await sleep(2100);
  await shot(a, "lobby-polished");
  for (const [i, p] of players.entries()) {
    await p.eval(`document.querySelectorAll('.avatar-option')[${i}].click()`);
    await p.clickText("Join our adventure");
  }
  await sleep(2200);
  await shot(a, "camera-tutorial");
  assert.equal(
    await a.eval(
      `!![...document.querySelectorAll('.camera-onboarding button')].find(b=>b.textContent.trim()==='Enable camera')`,
    ),
    true,
  );
  await a.eval(
    `(()=>{window.__cameraRequests=[];navigator.mediaDevices.getUserMedia=async c=>{window.__cameraRequests.push(c);throw new DOMException('test blocked','NotAllowedError');};})()`,
  );
  await a.clickText("Enable camera");
  await sleep(200);
  assert.match(
    await a.eval(`document.querySelector('.camera-setup-error').textContent`),
    /blocked|permission/i,
  );
  assert.equal(await a.eval(`window.__cameraRequests[0].audio`), false);
  await shot(a, "camera-blocked-feedback");
  await a.eval(
    `(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;window.__testCameraTimer=setInterval(()=>{const x=c.getContext('2d');x.fillStyle='#418e75';x.fillRect(0,0,320,240);x.fillStyle='#ffeac4';x.font='32px sans-serif';x.fillText('Mingy',80,115);x.fillText(Date.now()%100000,60,180);},80);navigator.mediaDevices.getUserMedia=async constraints=>{window.__cameraRequests.push(constraints);return c.captureStream(12);};})()`,
  );
  await a.clickText("Enable camera");
  await sleep(1500);
  assert.equal(await a.eval(`window.__mingy.camera.active`), true);
  assert.equal(
    await a.eval(`window.__mingy.camera.stream.getAudioTracks().length`),
    0,
  );
  assert.equal(
    await a.eval(
      `document.querySelector('.camera-onboarding video').readyState>=2`,
    ),
    true,
  );
  assert.equal(
    await a.eval(`!!document.querySelector('.camera-setup-error')`),
    false,
  );
  await shot(a, "camera-preview-enabled");
  await a.eval(`window.__mingy.camera.disable()`);
  for (const p of players) await p.clickText("Ready, Mingy");
  await sleep(1500);
  await shot(a, "house-polished");
  await shot(b, "girl-polished");
  const metrics = await a.eval(
    `new Promise(resolve=>{let n=0;const start=performance.now();function frame(){n++;if(performance.now()-start>6000){const gl=window.__mingyGraphics.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');resolve({fps:n*1000/(performance.now()-start),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',audio:window.__mingy.audioStatus()});}else requestAnimationFrame(frame);}requestAnimationFrame(frame);})`,
  );
  console.log(
    "Camera request, denial feedback, retry, live preview and video-only constraints passed",
  );
  console.log("Rendering/audio", metrics);
  fs.writeFileSync(
    "output/v2/onboarding-report.json",
    JSON.stringify({ camera: "passed", metrics, room }, null, 2),
  );
} finally {
  a.close();
  b.close();
}
