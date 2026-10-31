import { spawn } from "./content";
import type { Pose, Role } from "./content";
import type { State, Action } from "../../server/autumn/rules";
export type Snapshot = {
  status: "idle" | "connecting" | "connected" | "reconnecting" | "error";
  state: State | null;
  role: Role;
  room: string;
  peer: boolean;
  error: string;
  pending: number;
};
class Network extends EventTarget {
  snapshot: Snapshot = {
    status: "idle",
    state: null,
    role: 0,
    room: "",
    peer: false,
    error: "",
    pending: 0,
  };
  listeners = new Set<() => void>();
  ws: WebSocket | null = null;
  local = spawn(0);
  poses: Record<string, Pose> = {};
  fast: RTCDataChannel | null = null;
  lastPeerPacket = 0;
  lastPacket = 0;
  lastPeer = 0;
  lastDurable = 0;
  clockOffset = 0;
  control = 0;
  roundTrip = 0;
  playerId = "";
  requestedRoom = "";
  closed = true;
  retry = 0;
  timer = 0;
  ticker = 0;
  pending = new Map<string, { action: Action; at: number }>();
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };
  getSnapshot = () => this.snapshot;
  update(p: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...p };
    this.listeners.forEach((f) => f());
  }
  event(name: string, detail: any) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
  enter(role: Role, room = "") {
    this.leave();
    this.closed = false;
    this.requestedRoom = room;
    this.retry = 0;
    this.playerId =
      localStorage.getItem("autumn-device") || crypto.randomUUID();
    localStorage.setItem("autumn-device", this.playerId);
    this.local = spawn(role);
    this.poses = {};
    this.pending.clear();
    this.update({
      status: "connecting",
      role,
      room,
      state: null,
      peer: false,
      error: "",
      pending: 0,
    });
    this.ticker = window.setInterval(() => {
      if (this.closed) return;
      const now = Date.now();
      if (this.ws?.readyState === 1) {
        this.send({ type: "pong" });
        this.send({ type: "clock", at: Date.now() });
        if (now - this.lastPacket > 4500) {
          this.reconnect();
          return;
        }
        if (this.snapshot.status === "connected") {
          this.send({ type: "pose", pose: this.local });
          for (const item of this.pending.values())
            if (now - item.at > 1100) {
              this.send({ type: "action", action: item.action });
              item.at = now;
            }
        }
      } else if (
        now - this.lastPacket > 7000 &&
        this.snapshot.status === "connecting"
      )
        this.reconnect();
      if (this.snapshot.peer && now - this.lastPeer > 7000)
        this.update({ peer: false });
    }, 1000);
    window.addEventListener("online", this.online);
    document.addEventListener("visibilitychange", this.visible);
    this.connect();
  }
  online = () => {
    if (!this.closed && this.snapshot.status !== "connected") this.reconnect();
  };
  visible = () => {
    if (!document.hidden && !this.closed) {
      if (Date.now() - this.lastPacket > 3000) this.reconnect();
      else this.send({ type: "pose", pose: this.local });
    }
  };
  connect() {
    if (this.closed) return;
    const old = this.ws;
    this.ws = null;
    old?.close();
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/ws?game=autumn`,
    );
    this.ws = ws;
    this.lastPacket = Date.now();
    let received: State | null = null;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.send({
        type: "join",
        role: this.snapshot.role,
        room: this.requestedRoom,
        playerId: this.playerId,
      });
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      this.lastPacket = Date.now();
      if (m.type === "clock" && Number.isFinite(m.sent)) {
        this.roundTrip = Date.now() - m.sent;
        this.clockOffset = m.at - (m.sent + Date.now()) / 2;
      } else if (m.type === "welcome" && m.at)
        this.clockOffset = m.at - Date.now();
      if (m.state && (!received || m.state.version >= received.version))
        received = m.state;
      if (m.type === "welcome") {
        this.retry = 0;
        this.local = m.pose;
        this.poses = m.poses || {};
        this.lastPeer = Date.now();
        this.update({
          status: "connected",
          role: m.role,
          room: m.room,
          state: received,
          peer: !!m.poses[1 - m.role],
          error: "",
        });
        localStorage.setItem("autumn-role", String(m.role));
        this.event("welcome", m);
        for (const item of this.pending.values()) {
          this.send({ type: "action", action: item.action });
          item.at = Date.now();
        }
      } else if (
        m.state &&
        (!this.snapshot.state || m.state.version >= this.snapshot.state.version)
      )
        this.update({ state: m.state });
      if (m.type === "sync") {
        const peer = m.poses[1 - this.snapshot.role];
        if (peer && Date.now() + this.clockOffset - peer.time < 6500) {
          this.acceptPose(peer, false);
          this.lastPeer = Date.now();
          if (!this.snapshot.peer) this.update({ peer: true });
        }
      }
      if (
        (m.type === "pose" || m.type === "joined") &&
        m.role !== this.snapshot.role
      ) {
        this.acceptPose(m.pose, false);
        this.lastPeer = Date.now();
        if (!this.snapshot.peer) this.update({ peer: true });
        if (m.type === "joined") this.event("peer-joined", m);
      }
      if (m.type === "left" && m.role !== this.snapshot.role) {
        this.update({ peer: false });
        this.event("peer-left", m);
      }
      if (m.type === "ack") {
        this.pending.delete(m.id);
        this.update({ pending: this.pending.size });
        if (m.message) this.event("notice", m.message);
      }
      if (m.type === "ping") this.send({ type: "pong" });
      if (m.type === "fatal") {
        this.closed = true;
        this.update({ status: "error", error: m.message });
      }
      if (["rtc", "media", "video", "voice", "ping-mark"].includes(m.type))
        this.event(m.type, m);
    };
    ws.onerror = () => {};
    ws.onclose = (e) => {
      if (this.closed || this.ws !== ws) return;
      if ([4400, 4409, 4410].includes(e.code)) {
        this.closed = true;
        this.update({
          status: "error",
          error:
            e.code === 4410
              ? "This seat is open in another tab. Continue there or rejoin here."
              : "Both seats are in use, or this invitation is invalid.",
        });
        return;
      }
      this.update({ status: "reconnecting" });
      this.timer = window.setTimeout(
        () => this.connect(),
        Math.min(1800, 220 * 2 ** this.retry++) + Math.random() * 150,
      );
    };
  }
  reconnect() {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.update({ status: "reconnecting" });
    this.connect();
  }
  acceptPose(p: Pose, direct: boolean) {
    if (!p || ![p.x, p.z, p.y, p.yaw].every(Number.isFinite)) return;
    if (direct) this.lastPeerPacket = Date.now();
    const old = this.poses[1 - this.snapshot.role];
    // Server packets remain usable when an OPEN data channel silently stalls.
    if (
      !direct &&
      Date.now() - this.lastPeerPacket < 180 &&
      old?.seq > p.seq &&
      old.scene === p.scene
    )
      return;
    this.poses[1 - this.snapshot.role] = p;
    this.lastPeer = Date.now();
    if (!this.snapshot.peer) this.update({ peer: true });
  }
  move(p: Pose) {
    p.control = this.control;
    this.local = p;
    const direct = this.fast?.readyState === "open";
    if (direct && this.fast!.bufferedAmount < 12000) {
      try {
        this.fast!.send(JSON.stringify(p));
      } catch {}
    }
    if (performance.now() - this.lastDurable > (direct ? 140 : 65)) {
      this.lastDurable = performance.now();
      this.send({ type: "pose", pose: p });
    }
  }
  send(data: any) {
    if (this.ws?.readyState !== 1) return false;
    if (
      ["pose", "video", "voice"].includes(data.type) &&
      this.ws.bufferedAmount > 64000
    )
      return false;
    if (this.ws.bufferedAmount > 500000) {
      this.reconnect();
      return false;
    }
    this.ws.send(JSON.stringify(data));
    return true;
  }
  action(data: Omit<Action, "id" | "phase">) {
    if (this.snapshot.status !== "connected") {
      this.event("notice", "Reconnecting. Your progress is safe.");
      return;
    }
    if (this.pending.size > 16) return;
    if (
      ["sail", "kite"].includes(data.kind) &&
      [...this.pending.values()].some((p) => p.action.kind === data.kind)
    )
      return;
    const action = {
      ...data,
      at: Date.now() + this.clockOffset,
      id: crypto.randomUUID(),
      phase: this.snapshot.state?.phase,
    };
    this.send({ type: "pose", pose: this.local });
    this.pending.set(action.id, { action, at: Date.now() });
    this.update({ pending: this.pending.size });
    this.send({ type: "action", action });
  }
  leave() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.ticker);
    window.removeEventListener("online", this.online);
    document.removeEventListener("visibilitychange", this.visible);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.fast = null;
    this.pending.clear();
    this.update({ status: "idle", state: null, pending: 0 });
  }
}
export const net = new Network();
