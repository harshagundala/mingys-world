import {Browser,sleep} from './cdp.mjs';
const room=crypto.randomUUID().replaceAll('-','');
const a=await new Browser('mingy-a').connect(),b=await new Browser('mingy-b').connect();
for(const p of [a,b])await p.eval(`(()=>{window.__mingy?.camera.disable();window.__mingy?.session.leave();history.replaceState(null,'','/#room=${room}');location.reload();})()`);
await sleep(1800);
for(const [i,p] of [a,b].entries()){await p.eval(`document.querySelectorAll('.avatar-option')[${i}].click()`);await p.clickText('Join our adventure');}
await sleep(2300);for(const p of [a,b])await p.clickText('Ready, Mingy');await sleep(500);
console.log('Fresh two-player QA room ready');a.close();b.close();
