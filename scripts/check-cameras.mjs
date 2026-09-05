import assert from "node:assert/strict";
import { Browser, sleep } from "./cdp.mjs";
const a = await new Browser("mingy-a").connect(),
  b = await new Browser("mingy-b").connect();
try {
  for (const [i, p] of [a, b].entries()) {
    await p.eval(
      `(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;let n=0;window.__testCameraTimer=setInterval(()=>{const x=c.getContext('2d');x.fillStyle='${i ? "#aa6783" : "#418e75"}';x.fillRect(0,0,320,240);x.fillStyle='#ffeac4';x.font='32px sans-serif';x.fillText('Mingy ${i + 1}',70,115);x.fillRect((n++*5)%300,170,20,20);},80);const stream=c.captureStream(12);navigator.mediaDevices.getUserMedia=async constraints=>{window.__cameraRequest=constraints;return stream;};return true;})()`,
    );
    await p.eval(
      `document.querySelector('[aria-label="Turn camera on"]').click()`,
    );
  }
  await sleep(2500);
  for (const [i, p] of [a, b].entries()) {
    const state = await p.eval(
      `Promise.resolve({camera:window.__mingy.camera}).then(async({camera:c})=>({audio:window.__cameraRequest.audio,audioTracks:c.stream.getAudioTracks().length,local:c.stream.getVideoTracks().length,remote:c.remote?.getVideoTracks().length,state:c.pc.connectionState,transceivers:c.pc.getTransceivers().map(t=>({direction:t.direction,current:t.currentDirection})),stats:[...(await c.pc.getStats()).values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='video').map(s=>({framesDecoded:s.framesDecoded,framesPerSecond:s.framesPerSecond}))}))`,
    );
    assert.equal(state.audio, false);
    assert.equal(state.audioTracks, 0);
    assert.equal(state.local, 1);
    assert.equal(state.remote, 1);
    assert.ok(state.stats[0].framesDecoded > 5);
    console.log("Bidirectional camera", i, state);
  }
  await b.eval(
    `document.querySelector('[aria-label="Turn camera off"]').click()`,
  );
  await sleep(250);
  assert.equal(
    await a.eval(
      `Promise.resolve({camera:window.__mingy.camera}).then(m=>m.camera.remote===null)`,
    ),
    true,
  );
  // A fresh synthetic stream on the next enable models starting the hardware camera again.
  await b.eval(
    `(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;setInterval(()=>{const x=c.getContext('2d');x.fillStyle='#9a6482';x.fillRect(0,0,320,240);x.fillStyle='white';x.fillText(Date.now(),20,20);},80);navigator.mediaDevices.getUserMedia=async()=>c.captureStream(12);document.querySelector('[aria-label="Turn camera on"]').click();})()`,
  );
  await sleep(1000);
  assert.equal(
    await a.eval(
      `Promise.resolve({camera:window.__mingy.camera}).then(m=>m.camera.remote?.getVideoTracks().length)`,
    ),
    1,
  );
  console.log("Camera off/on recovery: passed");
  // Force the direct path to close: real compressed image frames must keep arriving over WebSocket.
  for (const p of [a, b])
    await p.eval(
      `Promise.resolve({camera:window.__mingy.camera}).then(m=>m.camera.disconnect())`,
    );
  await sleep(1700);
  for (const [i, p] of [a, b].entries()) {
    assert.ok(
      (await p.eval(
        `Promise.resolve({camera:window.__mingy.camera}).then(m=>m.camera.remoteFrame.length)`,
      )) > 1000,
    );
    console.log("Network fallback frame", i, "received");
  }
  await a.eval(
    `Promise.resolve({camera:window.__mingy.camera}).then(m=>m.camera.connect())`,
  );
  await sleep(2500);
  console.log(
    "Direct recovery",
    await a.eval(
      `Promise.resolve({session:window.__mingy.session}).then(m=>m.session.fastTransport?.readyState)`,
    ),
  );
} finally {
  a.close();
  b.close();
}
