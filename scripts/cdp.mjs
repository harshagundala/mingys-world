import { findPath } from "./navigation.mjs";
import WebSocket from "ws";
import { execFileSync } from "node:child_process";
export class Browser {
  constructor(name) {
    this.name =
      process.env[name === "mingy-a" ? "QA_BROWSER_A" : "QA_BROWSER_B"] || name;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async connect() {
    const endpoint = execFileSync(
      "npx",
      ["agent-browser", "--session", this.name, "get", "cdp-url"],
      { encoding: "utf8", timeout: 15000 },
    ).trim();
    this.ws = new WebSocket(endpoint);
    await new Promise((r, j) => {
      this.ws.on("open", r);
      this.ws.on("error", j);
    });
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.id) {
        const p = this.pending.get(m.id);
        if (p) {
          this.pending.delete(m.id);
          clearTimeout(p.timer);
          m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
        }
      } else {
        for (const f of this.listeners.get(m.method) || []) f(m.params);
      }
    });
    const { targetInfos } = await this.call("Target.getTargets");
    const target = targetInfos.find(
      (t) =>
        t.type === "page" && t.url.includes(process.env.QA_TARGET || "5173"),
    );
    if (!target) throw new Error("Game tab not found");
    this.sessionId = (
      await this.call("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
      })
    ).sessionId;
    await this.call("Runtime.enable", {}, true);
    await this.call("Page.enable", {}, true);
    return this;
  }
  call(method, params = {}, page = false) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${this.name}: ${method} timed out`));
      }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(page ? { sessionId: this.sessionId } : {}),
        }),
      );
    });
  }
  async eval(expression) {
    const r = await this.call(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
      true,
    );
    if (r.exceptionDetails)
      throw new Error(
        r.exceptionDetails.exception?.description || r.exceptionDetails.text,
      );
    return r.result.value;
  }
  async state() {
    return this.eval(
      `Promise.resolve({session:window.__mingy.session}).then(m=>({snapshot:m.session.snapshot,local:m.session.local,poses:m.session.poses,direct:m.session.fastTransport?.readyState}))`,
    );
  }
  async key(code, down = true) {
    await this.call(
      "Input.dispatchKeyEvent",
      {
        type: down ? "keyDown" : "keyUp",
        key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code,
        code,
        windowsVirtualKeyCode:
          {
            ArrowUp: 38,
            ArrowDown: 40,
            ArrowLeft: 37,
            ArrowRight: 39,
            Space: 32,
            ShiftLeft: 16,
            Escape: 27,
            KeyE: 69,
          }[code] || 0,
      },
      true,
    );
  }
  async move(x, z, { timeout = 24000 } = {}) {
    const initial = await this.state(),
      boxes = await this.eval("window.__mingy.getObstacles?.()||[]");
    const points = findPath(
      { x: initial.local.x, z: initial.local.z },
      { x, z },
      boxes,
    );
    const start = Date.now();
    for (const target of points) {
      while (Date.now() - start < timeout) {
        const { local } = await this.state();
        const dx = target.x - local.x,
          dz = target.z - local.z,
          d = Math.hypot(dx, dz);
        if (d < 0.22) break;
        const magnitude = Math.min(1, d / 0.8);
        await this.eval(
          `(()=>{const c=window.__mingy.controls;c.keys.clear();c.keys.add('ShiftLeft');c.touch={x:${(dx / d) * magnitude},z:${(dz / d) * magnitude}};})()`,
        );
        await new Promise((r) => setTimeout(r, 80));
      }
      if (Date.now() - start >= timeout) {
        await this.eval(
          `(()=>{window.__mingy.controls.keys.clear();window.__mingy.controls.touch={x:0,z:0};})()`,
        );
        throw new Error(
          "Movement blocked at " +
            JSON.stringify(target) +
            " en route to " +
            x +
            "," +
            z,
        );
      }
    }
    await this.eval(
      `(()=>{window.__mingy.controls.keys.clear();window.__mingy.controls.touch={x:0,z:0};})()`,
    );
    return (await this.state()).local;
  }

  async clickText(text) {
    return this.eval(
      `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Button not found');b.click();return true;})()`,
    );
  }
  async press(code) {
    await this.key(code, true);
    await this.key(code, false);
  }
  close() {
    this.ws?.close();
  }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
