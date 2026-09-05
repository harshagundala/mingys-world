import { Browser, sleep } from "./cdp.mjs";
const a = await new Browser("mingy-a").connect(),
  b = await new Browser("mingy-b").connect();
for (const p of [a, b]) await p.eval("location.reload()");
await sleep(1500);
for (const [i, p] of [a, b].entries()) {
  await p.eval(`document.querySelectorAll('.avatar-option')[${i}].click()`);
  await p.clickText("Join our adventure");
}
await sleep(2300);
for (const p of [a, b]) await p.clickText("Ready, Mingy");
await sleep(1000);
for (const [i, p] of [a, b].entries())
  console.log(
    i,
    await p.eval(
      `Promise.all([Promise.resolve({session:window.__mingy.session}),Promise.resolve({camera:window.__mingy.camera})]).then(([s,c])=>({status:s.session.snapshot.status,chapter:s.session.snapshot.state?.chapter,rtc:c.camera.pc?.connectionState,direct:s.session.fastTransport?.readyState}))`,
    ),
  );
a.close();
b.close();
