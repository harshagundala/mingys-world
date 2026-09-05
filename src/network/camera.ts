import { session } from "./session";
class Camera extends EventTarget {
  stream: MediaStream | null = null;
  remote: MediaStream | null = null;
  remoteEnabled = false;
  receiverTrack: MediaStreamTrack | null = null;
  pc: RTCPeerConnection | null = null;
  video = document.createElement("video");
  canvas = document.createElement("canvas");
  timer = 0;
  active = false;
  generation = 0;
  pending: RTCIceCandidateInit[] = [];
  remoteFrame = "";
  constructor() {
    super();
    this.video.muted = true;
    this.video.playsInline = true;
    this.canvas.width = 192;
    this.canvas.height = 144;
    session.addEventListener(
      "rtc",
      (e: any) => void this.signal(e.detail.data),
    );
    session.addEventListener("camera", (e: any) => {
      this.remoteEnabled = true;
      this.remoteFrame = e.detail.frame;
      if (this.pc?.connectionState !== "connected") this.remote = null;
      this.dispatchEvent(new Event("frame"));
    });
    session.addEventListener("camera-on", () => {
      this.remoteEnabled = true;
      const track =
        this.receiverTrack ||
        this.pc?.getReceivers().find((r) => r.track.kind === "video")?.track;
      if (track && this.pc?.connectionState === "connected") {
        this.remote = new MediaStream([track]);
        this.dispatchEvent(new Event("change"));
      }
    });
    session.addEventListener("camera-off", () => {
      this.remoteEnabled = false;
      this.remote = null;
      this.remoteFrame = "";
      this.dispatchEvent(new Event("change"));
    });
  }
  async enable() {
    if (this.active) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error(
        "Camera access is unavailable in this browser preview. Open your invitation directly in Chrome or Edge, then choose Enable camera.",
      );
      error.name = "CameraUnavailableError";
      throw error;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 384 },
        height: { ideal: 288 },
        frameRate: { ideal: 15, max: 20 },
      },
      audio: false,
    });
    try {
      this.stream = stream;
      stream
        .getVideoTracks()
        .forEach((track) =>
          track.addEventListener("ended", () => this.disable(), { once: true }),
        );
      this.video.srcObject = stream;
      await this.video.play();
      this.active = true;
      const sender =
        this.pc?.getSenders().find((s) => s.track?.kind === "video") ||
        this.pc?.getTransceivers()[0]?.sender;
      if (sender) await sender.replaceTrack(stream.getVideoTracks()[0]);
      this.timer = window.setInterval(() => {
        if (!this.active || document.hidden || !session.snapshot.otherOnline)
          return;
        if (this.pc?.connectionState === "connected") return;
        const ctx = this.canvas.getContext("2d");
        if (!ctx || this.video.readyState < 2) return;
        ctx.drawImage(this.video, 0, 0, 192, 144);
        session.send({
          type: "camera",
          frame: this.canvas.toDataURL("image/jpeg", 0.55),
        });
      }, 190);
      session.send({ type: "camera-on" });
      this.dispatchEvent(new Event("change"));
    } catch (error) {
      this.disable();
      throw error;
    }
  }
  disable() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.active = false;
    this.video.srcObject = null;
    clearInterval(this.timer);
    void this.pc
      ?.getTransceivers()[0]
      ?.sender.replaceTrack(null)
      .catch(() => {});
    session.send({ type: "camera-off" });
    this.dispatchEvent(new Event("change"));
  }
  async connect() {
    this.disconnect();
    const generation = ++this.generation;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    this.pc = pc;
    const bind = (channel: RTCDataChannel) => {
      session.fastTransport = channel;
      channel.onmessage = (event) => {
        try {
          session.receivePeerPose(JSON.parse(event.data));
        } catch {}
      };
      channel.onclose = () => {
        if (session.fastTransport === channel) session.fastTransport = null;
      };
    };
    if (session.snapshot.role === 0)
      bind(
        pc.createDataChannel("puppy-motion", {
          ordered: false,
          maxRetransmits: 0,
        }),
      );
    else pc.ondatachannel = (e) => bind(e.channel);
    if (session.snapshot.role === 0) {
      const t = pc.addTransceiver("video", { direction: "sendrecv" });
      if (this.stream)
        await t.sender.replaceTrack(this.stream.getVideoTracks()[0]);
    }
    pc.onicecandidate = (e) => {
      if (e.candidate)
        session.send({
          type: "rtc",
          data: { candidate: e.candidate.toJSON() },
        });
    };
    pc.ontrack = (e) => {
      this.receiverTrack = e.track;
      if (this.remoteEnabled && pc.connectionState === "connected") {
        this.remote = new MediaStream([e.track]);
        this.remoteFrame = "";
        this.dispatchEvent(new Event("change"));
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === "connected") {
        if (this.remoteEnabled && this.receiverTrack) {
          this.remote = new MediaStream([this.receiverTrack]);
          this.remoteFrame = "";
          this.dispatchEvent(new Event("change"));
        }
        session.send({ type: this.active ? "camera-on" : "camera-off" });
      }
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        this.remote = null;
        this.dispatchEvent(new Event("change"));
      }
    };
    if (session.snapshot.role === 0) {
      await new Promise((r) => setTimeout(r, 250));
      if (this.generation !== generation) return;
      try {
        await pc.setLocalDescription(await pc.createOffer());
        session.send({
          type: "rtc",
          data: { description: pc.localDescription },
        });
      } catch {}
    } else session.send({ type: "rtc", data: { requestOffer: true } });
  }
  async signal(data: any) {
    if (!session.snapshot.otherOnline) return;
    if (data.requestOffer && session.snapshot.role === 0) {
      await this.connect();
      return;
    }
    if (!this.pc) await this.connect();
    const pc = this.pc!;
    try {
      if (data.description) {
        await pc.setRemoteDescription(data.description);
        for (const c of this.pending) await pc.addIceCandidate(c);
        this.pending = [];
        if (data.description.type === "offer") {
          for (const t of pc.getTransceivers()) {
            if (t.receiver.track.kind === "video") {
              t.direction = "sendrecv";
              await t.sender.replaceTrack(
                this.stream?.getVideoTracks()[0] || null,
              );
            }
          }
          await pc.setLocalDescription(await pc.createAnswer());
          session.send({
            type: "rtc",
            data: { description: pc.localDescription },
          });
        }
      }
      if (data.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
        else this.pending.push(data.candidate);
      }
    } catch {
      /* WebSocket camera relay remains available when peer negotiation cannot connect. */
    }
  }
  disconnect() {
    session.fastTransport = null;
    this.generation++;
    this.pc?.close();
    this.pc = null;
    this.remote = null;
    this.receiverTrack = null;
    this.pending = [];
  }
}
export const camera = new Camera();
