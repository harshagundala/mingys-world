import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("the authoritative adventure imports in native Node without the development loader", () => {
  const entry = new URL("../server/autumn/rules.ts", import.meta.url).href;
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `const {initialState,normalizeState}=await import(${JSON.stringify(entry)}); const s=normalizeState(initialState()); if(s.phase!==0 || !s.expedition || !s.continuousReceipts) process.exit(1);`,
  ], { encoding: "utf8", timeout: 10000, env: { ...process.env, NODE_OPTIONS: "" } });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
