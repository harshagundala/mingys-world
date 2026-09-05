import assert from "node:assert/strict";
import fs from "node:fs";
import { Browser, sleep } from "./cdp.mjs";
const origin = "https://mingys-world.vercel.app";
const room = "qa-" + crypto.randomUUID();
const players = [];
const report = [];
const log = (name, data = {}) => {
  console.log(name, data);
  report.push({ name, ...data });
};
async function until(p, expression, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await p.eval(expression);
    if (value) return value;
    await sleep(150);
  }
  throw new Error("Browser condition timed out: " + expression);
}
try {
  for (const [i, name] of ["mingy-a", "mingy-b"].entries()) {
    const p = await new Browser(name).connect();
    players.push(p);
    p.errors = [];
    p.listeners.set("Runtime.exceptionThrown", [
      (e) =>
        p.errors.push(
          e.exceptionDetails.exception?.description || e.exceptionDetails.text,
        ),
    ]);
    await p.call(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `
 window.__qa={sockets:[],peers:[],outgoing:[],messages:[],cameraRequests:[]};
 const NativeWS=window.WebSocket;window.WebSocket=class extends NativeWS{constructor(...args){super(...args);if(String(args[0]).includes('/api/ws')){window.__qa.sockets.push(this);this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.state)window.__qa.state=m.state;if(m.type==='pose')window.__qa.partner=m.pose;window.__qa.messages.push(m.type);});}}send(raw){try{const m=JSON.parse(raw);if(window.__qa.blockDirect&&m.type==='rtc'){if(m.data.candidate)return;if(m.data.description){m.data.description.sdp=m.data.description.sdp.split('\\r\\n').filter(line=>!line.startsWith('a=candidate:')).join('\\r\\n');raw=JSON.stringify(m);}}if(m.type==='pose'){window.__qa.pose=m.pose;window.__qa.outgoing.push(m.pose);if(window.__qa.outgoing.length>400)window.__qa.outgoing.shift();}}catch{}return super.send(raw);}};
 const NativeRTC=window.RTCPeerConnection;window.RTCPeerConnection=class extends NativeRTC{constructor(...args){super(...args);window.__qa.peers.push(this);}};
 navigator.mediaDevices.getUserMedia=async constraints=>{window.__qa.cameraRequests.push(constraints);const c=document.createElement('canvas');c.width=320;c.height=240;let n=0;setInterval(()=>{const x=c.getContext('2d');x.fillStyle='${i ? "#9c687b" : "#487d66"}';x.fillRect(0,0,320,240);x.fillStyle='#ffeac4';x.font='24px sans-serif';x.fillText('Mingy ${i + 1}',80,100);x.fillRect((n++*7)%300,160,20,20);},80);return c.captureStream(12);};
 `,
      },
      true,
    );
    await p.call(
      "Page.navigate",
      {
        url:
          origin +
          "/#" +
          new URLSearchParams({
            invite: process.env.WORLD_SECRET.trim(),
            room,
          }),
      },
      true,
    );
    await p.call("Page.reload", {}, true);
    await until(
      p,
      "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Join our adventure'&&!b.disabled)",
    );
    await p.eval(`document.querySelectorAll('.avatar-option')[${i}].click()`);
    await p.clickText("Join our adventure");
    await until(p, "window.__qa.state?.chapter===0");
    await p.clickText("Ready, Mingy");
  }
  const [a, b] = players;
  await until(a, "window.__qa.peers.at(-1)?.connectionState==='connected'");
  assert.equal(await a.eval("typeof window.__mingy"), "undefined");
  for (const [i, p] of players.entries()) {
    await p.press("Escape");
    if (i === 0) {
      await p.key("ArrowRight");
      await sleep(650);
      await p.key("ArrowRight", false);
    }
    const before = await p.eval("window.__qa.pose.z");
    await p.key("ArrowUp");
    await sleep(450);
    await p.key("ArrowUp", false);
    await sleep(400);
    const after = await p.eval("window.__qa.pose.z");
    assert.ok(before - after > 0.6);
    await p.press("Space");
    await sleep(500);
    assert.ok(
      await p.eval("window.__qa.outgoing.slice(-15).some(p=>p.y>0.35)"),
    );
    await sleep(300);
    await p.press("KeyE");
    await until(
      p,
      "document.querySelector('#panel-title')?.textContent==='The brass arrival bell'",
    );
    await p.clickText("Ring the bell");
    await p.press("Escape");
  }
  await until(a, "window.__qa.state?.chapter===1");
  await until(b, "window.__qa.state?.chapter===1");
  log(
    "Production keyboard movement, jump, interaction, two-player chapter and direct data channel passed",
  );
  for (const p of players) {
    await p.press("Escape");
    await p.eval(
      `document.querySelector('[aria-label="Turn camera on"]').click()`,
    );
  }
  await sleep(2800);
  async function video(p) {
    return p.eval(
      `(async()=>{const pc=window.__qa.peers.at(-1);return {connection:pc.connectionState,audioRequests:window.__qa.cameraRequests.map(c=>c.audio),audioTracks:pc.getSenders().filter(s=>s.track?.kind==='audio').length,inbound:[...(await pc.getStats()).values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='video').map(s=>s.framesDecoded),dataChannels:[...(await pc.getStats()).values()].filter(s=>s.type==='data-channel').map(s=>({state:s.state,messagesReceived:s.messagesReceived}))};})()`,
    );
  }
  for (const [i, p] of players.entries()) {
    const v = await video(p);
    assert.equal(v.connection, "connected");
    assert.ok(v.inbound[0] > 5);
    assert.equal(v.audioTracks, 0);
    assert.ok(v.audioRequests.every((a) => a === false));
    assert.ok(
      v.dataChannels.some((c) => c.state === "open" && c.messagesReceived > 10),
    );
    log("Production bidirectional video and movement", { player: i, ...v });
  }
  const oldCount = await a.eval("window.__qa.sockets.length");
  await a.eval(
    "window.__qa.sockets.at(-1).close(4000,'QA reconnection check')",
  );
  await until(
    a,
    `window.__qa.sockets.length>${oldCount}&&window.__qa.sockets.at(-1).readyState===1`,
  );
  await until(a, "window.__qa.peers.at(-1)?.connectionState==='connected'");
  await sleep(1800);
  assert.equal(await a.eval("window.__qa.state.chapter"), 1);
  for (const p of players) assert.ok((await video(p)).inbound[0] > 5);
  log(
    "Production WebSocket reconnection preserves progress and restores both cameras",
  );
  // Remove ICE candidates to model two laptops whose networks refuse a direct path.
  for (const p of players) {
    await p.eval(
      `document.querySelector('[aria-label="Turn camera off"]').click()`,
    );
    await p.eval("window.__qa.blockDirect=true");
  }
  await a.eval(
    "window.__qa.sockets.at(-1).close(4000,'QA blocked direct path')",
  );
  await sleep(3000);
  for (const p of players)
    await p.eval(
      `document.querySelector('[aria-label="Turn camera on"]').click()`,
    );
  for (const p of players) {
    await until(
      p,
      `[...document.querySelectorAll('.camera-tile img')].some(img=>getComputedStyle(img).display!=='none'&&img.naturalWidth>0&&img.src.startsWith('data:image/jpeg'))`,
    );
    assert.notEqual(
      await p.eval("window.__qa.peers.at(-1).connectionState"),
      "connected",
    );
  }
  log(
    "Both camera tiles receive live fallback frames with ICE candidates blocked",
  );
  for (const p of players) await p.eval("window.__qa.blockDirect=false");
  await a.eval(
    "window.__qa.sockets.at(-1).close(4000,'QA restore direct path')",
  );
  await until(a, "window.__qa.peers.at(-1)?.connectionState==='connected'");
  await sleep(1500);
  for (const p of players) assert.ok((await video(p)).inbound[0] > 5);
  log("Direct video recovers after the blocked-network test");

  const { data } = await a.call(
    "Page.captureScreenshot",
    { format: "png" },
    true,
  );
  fs.writeFileSync(
    "output/playwright/production-two-player.png",
    Buffer.from(data, "base64"),
  );
  for (const p of players) assert.deepEqual(p.errors, []);
  log("No uncaught browser errors on either production client");
  fs.writeFileSync(
    "output/production-browser-report.json",
    JSON.stringify(
      { passed: true, at: new Date().toISOString(), checks: report },
      null,
      2,
    ),
  );
} finally {
  for (const p of players) p.close();
}
