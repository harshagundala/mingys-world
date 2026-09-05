import type { GameState, Pose } from "../../server/rules";
import type { Role } from "../game/content";
export type Status =
  "idle" | "connecting" | "connected" | "reconnecting" | "error";
export type Snapshot = {
  status: Status;
  state: GameState | null;
  role: Role;
  room: string;
  notice: string;
  otherOnline: boolean;
  place: string;
  error: string;
};
class Session extends EventTarget {
  snapshot: Snapshot = {
    status: "idle",
    state: null,
    role: 0,
    room: "",
    notice: "",
    otherOnline: false,
    place: "house",
    error: "",
  };
  fastTransport: RTCDataChannel | null = null;
  lastDurablePose = 0;
  ws: WebSocket | null = null;
  listeners = new Set<() => void>();
  poses: Record<string, Pose> = {};
  local: Pose = {
    place: "house",
    x: -0.8,
    y: 0,
    z: 8,
    rot: 0,
    moving: false,
    time: 0,
  };
  lastRemote = 0;
  playerId = "";
  requestedRoom = "";
  closed = false;
  retry = 0;
  timer = 0;
  pingTimer = 0;
  latency = 0;
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => {
      this.listeners.delete(f);
    };
  };
  getSnapshot = () => this.snapshot;
  update(p: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...p };
    for (const l of this.listeners) l();
  }
  enter(room: string, role: Role) {
    clearTimeout(this.timer);
    const previous = this.ws;
    this.ws = null;
    previous?.close();
    this.closed = false;
    this.retry = 0;
    this.requestedRoom = room;
    this.playerId =
      localStorage.getItem("mingy-device-id") ||
      (room && localStorage.getItem(`mingy-player-${room}-${role}`)) ||
      crypto.randomUUID();
    localStorage.setItem("mingy-device-id", this.playerId);
    this.poses = {};
    this.update({
      room,
      role,
      state: null,
      otherOnline: false,
      status: "connecting",
      error: "",
    });
    clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (this.snapshot.status === "connected")
        this.send({ type: "pose", pose: this.local });
      if (this.snapshot.otherOnline && Date.now() - this.lastRemote > 14000)
        this.update({ otherOnline: false });
    }, 4000);
    this.connect();
  }
  connect() {
    if (this.closed) return;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/api/ws`);
    let receivedState: GameState | null = null;
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.send({
        type: "join",
        room: this.requestedRoom,
        role: this.snapshot.role,
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
      // Pub/sub can deliver an update before the welcome finishes. Keep the
      // newest state for this connection, including when a reset changed rooms.
      if (
        m.state &&
        (!receivedState || m.state.version >= receivedState.version)
      )
        receivedState = m.state;
      if (m.type === "welcome") {
        this.retry = 0;
        this.poses = m.poses || {};
        this.local = m.pose;
        this.lastRemote = Date.now();
        this.update({
          state: receivedState,
          role: m.role,
          room: m.room || this.requestedRoom,
          status: "connected",
          place: m.pose.place,
          otherOnline: !!m.poses[1 - m.role],
          error: "",
        });
        this.dispatchEvent(new CustomEvent("travel", { detail: m.pose }));
      }
      if (m.type === "world-reset" && !this.requestedRoom) {
        location.replace("/");
        return;
      }
      if (
        m.type === "state" &&
        (!this.snapshot.state || m.state.version >= this.snapshot.state.version)
      )
        this.update({ state: m.state });
      if (m.type === "pose" || m.type === "joined") {
        if (m.role !== this.snapshot.role) {
          if (
            this.fastTransport?.readyState !== "open" ||
            m.type === "joined" ||
            this.poses[m.role]?.place !== m.pose.place
          )
            this.poses[m.role] = m.pose;
          this.lastRemote = Date.now();
          if (!this.snapshot.otherOnline) this.update({ otherOnline: true });
        }
      }
      if (m.type === "left" && m.role !== this.snapshot.role)
        this.update({ otherOnline: false });
      if (m.type === "travel") {
        this.local = m.pose;
        this.update({ place: m.pose.place });
        this.dispatchEvent(new CustomEvent("travel", { detail: m.pose }));
      }
      if (m.type === "notice") {
        this.update({ notice: m.message });
        this.dispatchEvent(new CustomEvent("notice", { detail: m.message }));
      }
      if (m.type === "error") {
        this.update({
          error: m.message,
          ...(m.fatal ? { status: "error" as Status } : {}),
        });
        if (m.fatal) this.closed = true;
        this.dispatchEvent(new CustomEvent("notice", { detail: m.message }));
      }
      if (m.type === "ping") {
        this.send({ type: "pong" });
      }
      if (
        m.type === "camera" ||
        m.type === "camera-off" ||
        m.type === "camera-on" ||
        m.type === "rtc" ||
        m.type === "bark"
      )
        this.dispatchEvent(new CustomEvent(m.type, { detail: m }));
    };
    ws.onerror = () => {};
    ws.onclose = (event) => {
      if (this.closed || this.ws !== ws) return;
      if ([4401, 4409, 4410].includes(event.code)) {
        this.closed = true;
        this.update({
          status: "error",
          error:
            event.code === 4401
              ? "The house needs a refresh. Open the game again."
              : event.code === 4410
                ? "Your puppy is open in another tab. Continue there, or reload here to bring it back."
                : "Both puppies are already playing. Close the game on an extra device, then try again.",
        });
        return;
      }
      this.update({ status: "reconnecting" });
      this.timer = window.setTimeout(
        () => this.connect(),
        Math.min(6000, 700 * 2 ** this.retry++),
      );
    };
  }
  send(data: any) {
    if (this.ws?.readyState !== 1) return;
    const volatile = data.type === "pose" || data.type === "camera";
    if (volatile && this.ws.bufferedAmount > 120000) return;
    if (this.ws.bufferedAmount > 2000000) {
      this.ws.close(4000, "Connection is catching up");
      return;
    }
    this.ws.send(JSON.stringify(data));
  }
  action(action: any) {
    if (this.snapshot.status !== "connected") {
      this.dispatchEvent(
        new CustomEvent("notice", {
          detail: "Reconnecting to the house. Your progress is saved.",
        }),
      );
      return;
    }
    this.send({ type: "pose", pose: this.local });
    this.send({ type: "action", action });
  }
  receivePeerPose(p: Pose) {
    if (!p || ![p.x, p.y, p.z, p.rot].every(Number.isFinite)) return;
    const role = 1 - this.snapshot.role;
    this.poses[role] = p;
    this.lastRemote = Date.now();
    if (!this.snapshot.otherOnline) this.update({ otherOnline: true });
  }
  move(p: Pose) {
    this.local = p;
    const direct = this.fastTransport?.readyState === "open";
    if (direct && this.fastTransport!.bufferedAmount < 10000)
      this.fastTransport!.send(JSON.stringify(p));
    if (!direct || performance.now() - this.lastDurablePose > 450) {
      this.send({ type: "pose", pose: p });
      this.lastDurablePose = performance.now();
    }
  }

  leave() {
    this.closed = true;
    clearInterval(this.pingTimer);
    clearTimeout(this.timer);
    this.ws?.close();
    this.update({ status: "idle", state: null });
  }
}
export const session = new Session();
