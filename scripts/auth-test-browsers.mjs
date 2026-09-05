import { Browser, sleep } from "./cdp.mjs";
for (const name of ["mingy-a", "mingy-b"]) {
  const p = await new Browser(name).connect();
  const okay = await p.eval(
    `fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite:${JSON.stringify(process.env.WORLD_SECRET.trim())}})}).then(r=>r.ok)`,
  );
  if (!okay) throw new Error("Auth failed");
  await p.call(
    "Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    true,
  );
  await p.call("Page.reload", {}, true);
  p.close();
}
await sleep(1300);
console.log("Dedicated test browsers authenticated");
