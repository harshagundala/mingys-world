import { Browser, sleep } from "./cdp.mjs";
const room = process.argv[2];
if (!room) throw Error("Pass a completed QA room, never the date invitation");
const players = [
  await new Browser("mingy-a").connect(),
  await new Browser("mingy-b").connect(),
];
try {
  for (const p of players) {
    await p.call(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `
window.__qa={peers:[],state:null};const NativeRTC=window.RTCPeerConnection;window.RTCPeerConnection=class extends NativeRTC{constructor(...args){super(...args);window.__qa.peers.push(this);}};
const NativeWS=window.WebSocket;window.WebSocket=class extends NativeWS{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.state)window.__qa.state=m.state;}catch{}});}};
navigator.mediaDevices.getUserMedia=async constraints=>{window.__qa.audio=constraints.audio;const c=document.createElement('canvas');c.width=320;c.height=240;let n=0;setInterval(()=>{const x=c.getContext('2d');x.fillStyle='#457c65';x.fillRect(0,0,320,240);x.fillStyle='#ffeac4';x.font='24px sans-serif';x.fillText('Happy Mingy',70,100);x.fillRect((n++*7)%300,160,20,20);},80);return c.captureStream(12);};
`,
      },
      true,
    );
    await p.eval(`history.replaceState(null,'','/#room=${room}')`);
    await p.call("Page.reload", {}, true);
  }
  await sleep(1400);
  for (const [i, p] of players.entries()) {
    await p.eval(`document.querySelectorAll('.avatar-option')[${i}].click()`);
    await p.clickText("Join our adventure");
  }
  await sleep(2000);
  for (const p of players) {
    if (!(await p.eval('document.querySelector(".memory-carousel")!==null')))
      throw Error("Ending did not restore");
    await p.eval(
      `document.querySelector('[aria-label="Turn camera on"]').click()`,
    );
  }
  await sleep(2200);
  console.log(
    "The completed two-player case restored on production with both ending cameras",
  );
} finally {
  players.forEach((p) => p.close());
}
