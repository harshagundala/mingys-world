import { net } from "./network";
// ICE gathering appends candidates and may replace the placeholder transport
// address/port without creating a new offer. Preserve the actual SDP identity
// (origin version, credentials, fingerprints, media directions and codecs).
function offerIdentity(sdp: string | undefined) {
  return (sdp || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^(?:a=(?:candidate:|end-of-candidates|remote-candidates:|rtcp:)|c=)/.test(
          line,
        ),
    )
    .map((line) => line.replace(/^(m=\S+)\s+\d+/, "$1 9"))
    .join("\n");
}

export class Media extends EventTarget {
  stream = new MediaStream();
  remote = new MediaStream();
  pc: RTCPeerConnection | null = null;
  captures: Partial<Record<"camera" | "mic", Promise<void>>> = {};
  cameraOn = false;
  micOn = false;
  remoteCamera = false;
  remoteMic = false;
  frame = "";
  mode = "off";
  error = "";
  video = document.createElement("video");
  audio = document.createElement("audio");
  canvas = document.createElement("canvas");
  ctx: AudioContext | null = null;
  source: MediaStreamAudioSourceNode | null = null;
  processor: ScriptProcessorNode | null = null;
  silence: GainNode | null = null;
  nextAudio = 0;
  lastRelayAudio = 0;
  lastStatsBytes = 0;
  lastStatsAdvance = 0;
  healthy = false;
  generation = 0;
  pending: { candidate: RTCIceCandidateInit; session?: string }[] = [];
  session = "";
  retiredSessions = new Set<string>();
  lastRequestId = "";
  timer = 0;
  healthTimer = 0;
  retryTimer = 0;
  signalQueue = Promise.resolve();
  starting = false;
  forceRelay = false;
  receivedAudioChunks = 0;
  sentAudioChunks = 0;
  receivedVideoFrames = 0;
  lastOffer = 0;
  constructor() {
    super();
    this.video.muted = true;
    this.video.playsInline = true;
    this.audio.autoplay = true;
    this.canvas.width = 240;
    this.canvas.height = 180;
    net.addEventListener("rtc", (e: any) => {
      this.signalQueue = this.signalQueue
        .then(() => this.signal(e.detail.data))
        .catch(() => {});
    });
    net.addEventListener("media", (e: any) => {
      this.remoteCamera = e.detail.camera;
      this.remoteMic = e.detail.mic;
      if (!this.remoteCamera) this.frame = "";
      this.change();
    });
    net.addEventListener("video", (e: any) => {
      this.receivedVideoFrames++;
      this.frame = e.detail.frame;
      this.remoteCamera = true;
      this.change();
    });
    net.addEventListener("voice", (e: any) => this.playPCM(e.detail.pcm));
    net.addEventListener("peer-joined", () => {
      if (net.snapshot.status === "connected") void this.connect();
    });
  }
  change() {
    this.dispatchEvent(new Event("change"));
  }
  async unlock() {
    try {
      this.ctx ||= new AudioContext();
      await this.ctx.resume();
      if (this.remote.getAudioTracks().length) await this.audio.play();
    } catch {}
  }
  announce() {
    net.send({ type: "media", camera: this.cameraOn, mic: this.micOn });
  }
  enable(kind: "camera" | "mic"): Promise<void> {
    const type = kind === "camera" ? "video" : "audio";
    const enabled = kind === "camera" ? this.cameraOn : this.micOn;
    if (
      enabled &&
      this.stream
        .getTracks()
        .some((track) => track.kind === type && track.readyState !== "ended")
    )
      return Promise.resolve();
    const pending = this.captures[kind];
    if (pending) return pending;
    // Lobby capture and saved-preference restoration can overlap at join.
    // They share one permission request and one live track per media kind.
    const capture = this.capture(kind).finally(() => {
      if (this.captures[kind] === capture) delete this.captures[kind];
    });
    this.captures[kind] = capture;
    return capture;
  }
  private async capture(kind: "camera" | "mic") {
    await this.unlock();
    this.error = "";
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Open this page directly in Chrome, Edge, or Safari to use your camera and microphone.",
      );
    try {
      const captured = await navigator.mediaDevices.getUserMedia(
        kind === "camera"
          ? {
              video: {
                width: { ideal: 480 },
                height: { ideal: 360 },
                frameRate: { ideal: 20, max: 24 },
              },
              audio: false,
            }
          : {
              video: false,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
              },
            },
      );
      const track = captured.getTracks()[0];
      this.stream.addTrack(track);
      track.addEventListener("ended", () => this.disable(kind), { once: true });
      if (kind === "camera") {
        this.cameraOn = true;
        this.video.srcObject = this.stream;
        await this.video.play().catch(() => {});
      } else {
        this.micOn = true;
        this.captureVoice();
      }
      const sender = this.pc
        ?.getTransceivers()
        .find((t) => t.receiver.track.kind === track.kind)?.sender;
      await sender?.replaceTrack(track).catch(() => {});
      this.announce();
      this.change();
      this.startTimers();
    } catch (e: any) {
      this.error =
        e.name === "NotAllowedError"
          ? `${kind === "camera" ? "Camera" : "Microphone"} permission is blocked. Use the address-bar permissions to allow it, then try again.`
          : e.name === "NotReadableError"
            ? `Your ${kind === "camera" ? "camera" : "microphone"} is busy. Close another app using it, then try again.`
            : e.name === "NotFoundError"
              ? `No ${kind === "camera" ? "camera" : "microphone"} was found. You can still play.`
              : `Could not start your ${kind}. Check its browser permission and try again.`;
      this.change();
      throw new Error(this.error);
    }
  }
  disable(kind: "camera" | "mic") {
    const type = kind === "camera" ? "video" : "audio";
    for (const track of this.stream
      .getTracks()
      .filter((t) => t.kind === type)) {
      this.stream.removeTrack(track);
      track.stop();
    }
    void this.pc
      ?.getTransceivers()
      .find((t) => t.receiver.track.kind === type)
      ?.sender.replaceTrack(null)
      .catch(() => {});
    if (kind === "camera") {
      this.cameraOn = false;
      this.video.srcObject = this.stream;
    } else {
      this.micOn = false;
      this.processor?.disconnect();
      this.source?.disconnect();
      this.silence?.disconnect();
      this.processor = null;
      this.source = null;
      this.silence = null;
    }
    this.announce();
    this.change();
  }
  captureVoice() {
    if (!this.ctx) return;
    this.processor?.disconnect();
    this.source?.disconnect();
    this.silence?.disconnect();
    this.source = this.ctx.createMediaStreamSource(
      new MediaStream(this.stream.getAudioTracks()),
    );
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.silence = this.ctx.createGain();
    this.silence.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(this.silence);
    this.silence.connect(this.ctx.destination);
    this.processor.onaudioprocess = (e) => {
      if (
        !this.micOn ||
        !net.snapshot.peer ||
        (this.healthy && !this.forceRelay)
      )
        return;
      const input = e.inputBuffer.getChannelData(0),
        ratio = this.ctx!.sampleRate / 16000,
        length = Math.floor(input.length / ratio),
        pcm = new Int16Array(length);
      for (let i = 0; i < length; i++) {
        let sum = 0,
          count = 0;
        for (
          let j = Math.floor(i * ratio);
          j < Math.floor((i + 1) * ratio);
          j++
        ) {
          sum += input[j] || 0;
          count++;
        }
        pcm[i] = Math.max(-1, Math.min(1, sum / Math.max(1, count))) * 32767;
      }
      const bytes = new Uint8Array(pcm.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
      if (net.send({ type: "voice", pcm: btoa(binary) }))
        this.sentAudioChunks++;
    };
  }
  playPCM(raw: string) {
    if (!this.ctx || this.ctx.state !== "running") return;
    try {
      const binary = atob(raw);
      if (binary.length % 2 || binary.length > 12000) return;
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pcm = new Int16Array(bytes.buffer);
      const buffer = this.ctx.createBuffer(1, pcm.length, 16000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
      this.receivedAudioChunks++;
      this.lastRelayAudio = Date.now();
      this.audio.muted = true;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      // Never accumulate a delayed conversation after a network stall.
      if (
        this.nextAudio < this.ctx.currentTime ||
        this.nextAudio > this.ctx.currentTime + 0.38
      )
        this.nextAudio = this.ctx.currentTime + 0.035;
      source.start(this.nextAudio);
      this.nextAudio += buffer.duration;
      source.onended = () => source.disconnect();
    } catch {}
  }
  startTimers() {
    if (!this.timer)
      this.timer = window.setInterval(() => {
        if (
          this.cameraOn &&
          net.snapshot.peer &&
          (!this.healthy || this.forceRelay) &&
          this.video.readyState >= 2
        ) {
          const c = this.canvas.getContext("2d");
          c?.drawImage(this.video, 0, 0, 240, 180);
          net.send({
            type: "video",
            frame: this.canvas.toDataURL("image/jpeg", 0.5),
          });
        }
        if (Date.now() - this.lastRelayAudio > 650) this.audio.muted = false;
      }, 220);
    if (!this.healthTimer)
      this.healthTimer = window.setInterval(
        () => void this.checkHealth(),
        1200,
      );
  }
  async checkHealth() {
    const pc = this.pc;
    if (!pc) return;
    let bytes = 0;
    try {
      const stats = await pc.getStats();
      stats.forEach((s) => {
        if (s.type === "inbound-rtp") bytes += s.bytesReceived || 0;
      });
    } catch {}
    if (this.pc !== pc) return;
    if (bytes !== this.lastStatsBytes) {
      this.lastStatsBytes = bytes;
      this.lastStatsAdvance = Date.now();
    }
    const expected = this.remoteCamera || this.remoteMic;
    this.healthy =
      !this.forceRelay &&
      pc.connectionState === "connected" &&
      (!expected || Date.now() - this.lastStatsAdvance < 2200);
    this.mode = this.healthy ? "direct" : "relay";
    this.change();
    if (
      net.snapshot.peer &&
      ["failed", "disconnected"].includes(pc.connectionState) &&
      Date.now() - this.lastOffer > 3500
    )
      void this.connect();
    if (
      net.snapshot.peer &&
      pc.connectionState !== "connected" &&
      Date.now() - this.lastOffer > 9000
    )
      void this.connect();
  }
  async connect(requestOffer = true, offeredSession = "") {
    if (
      this.starting ||
      !net.snapshot.peer ||
      net.snapshot.status !== "connected"
    )
      return;
    this.disconnect();
    this.starting = true;
    this.session =
      net.snapshot.role === 0 ? crypto.randomUUID() : offeredSession;
    this.startTimers();
    this.lastOffer = Date.now();
    const generation = ++this.generation;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
      bundlePolicy: "max-bundle",
    });
    this.pc = pc;
    this.remote = new MediaStream();
    this.lastStatsAdvance = Date.now();
    const bind = (channel: RTCDataChannel) => {
      if (this.pc !== pc) return;
      net.fast = channel;
      channel.onmessage = (e) => {
        try {
          net.acceptPose(JSON.parse(e.data), true);
        } catch {}
      };
      channel.onclose = () => {
        if (net.fast === channel) net.fast = null;
      };
    };
    if (net.snapshot.role === 0)
      bind(
        pc.createDataChannel("last-light-motion", {
          ordered: false,
          maxRetransmits: 0,
        }),
      );
    else pc.ondatachannel = (e) => bind(e.channel);
    pc.onicecandidate = (e) => {
      if (e.candidate && this.pc === pc)
        net.send({
          type: "rtc",
          data: {
            candidate: e.candidate.toJSON(),
            generation,
            session: this.session,
          },
        });
    };
    pc.ontrack = (e) => {
      if (this.pc !== pc) return;
      this.remote.addTrack(e.track);
      this.audio.srcObject = new MediaStream(this.remote.getAudioTracks());
      void this.audio.play().catch(() => {});
      e.track.onunmute = () => this.change();
      this.change();
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      this.healthy = pc.connectionState === "connected" && !this.forceRelay;
      this.mode = this.healthy ? "direct" : "relay";
      this.announce();
      this.change();
    };
    try {
      if (net.snapshot.role === 0) {
        for (const kind of ["video", "audio"] as const) {
          const transceiver = pc.addTransceiver(kind, {
            direction: "sendrecv",
          });
          await transceiver.sender.replaceTrack(
            this.stream.getTracks().find((t) => t.kind === kind) || null,
          );
        }
        if (this.pc !== pc) return;
        await pc.setLocalDescription(await pc.createOffer());
        if (this.pc !== pc) return;
        net.send({
          type: "rtc",
          data: {
            description: pc.localDescription,
            generation,
            session: this.session,
          },
        });
      } else if (requestOffer) {
        net.send({
          type: "rtc",
          data: { requestOffer: true, requestId: crypto.randomUUID() },
        });
      }
    } catch {
    } finally {
      if (this.pc === pc) {
        this.starting = false;
        this.announce();
      }
    }
  }
  async signal(data: any) {
    if (!net.snapshot.peer || !data || typeof data !== "object") return;
    const session = typeof data.session === "string" ? data.session : undefined;
    const sendDescription = (pc: RTCPeerConnection) => {
      if (this.pc === pc && pc.localDescription)
        net.send({
          type: "rtc",
          data: {
            description: pc.localDescription,
            session: this.session,
            generation: this.generation,
          },
        });
    };
    if (data.requestOffer && net.snapshot.role === 0) {
      // Duplicate requests or a responder arriving while the initial offer is in
      // flight reuse that offer; neither should destroy a healthy negotiation.
      const duplicate =
        typeof data.requestId === "string" &&
        data.requestId === this.lastRequestId;
      if (typeof data.requestId === "string")
        this.lastRequestId = data.requestId;
      const pc = this.pc;
      if (
        pc?.localDescription?.type === "offer" &&
        (duplicate ||
          (pc.signalingState === "have-local-offer" &&
            Date.now() - this.lastOffer < 9000))
      ) {
        sendDescription(pc);
      } else if (!duplicate) await this.connect();
      return;
    }
    const description = data.description;
    if (description?.type === "offer" && net.snapshot.role === 1) {
      if (session && this.retiredSessions.has(session)) return;
      let pc = this.pc;
      // A session, not the raw SDP string, identifies an offer: ICE gathering
      // appends candidate lines to localDescription after the original send.
      // Re-answer that same negotiation without retiring its active session.
      if (
        pc?.remoteDescription?.type === "offer" &&
        (session
          ? this.session === session
          : offerIdentity(pc.remoteDescription.sdp) ===
            offerIdentity(description.sdp))
      ) {
        if (pc.localDescription?.type === "answer") sendDescription(pc);
        return;
      }
      const queued = this.pending.filter(
        (item) => !item.session || item.session === session,
      );
      if (!pc || pc.remoteDescription) {
        // Receiving an offer must NOT send requestOffer: that creates an
        // offer -> request -> offer feedback loop between the two browsers.
        await this.connect(false, session || "");
        pc = this.pc;
      } else this.session = session || "";
      if (!pc) return;
      this.pending = queued;
      try {
        await pc.setRemoteDescription(description);
        if (this.pc !== pc) return;
        await this.flushCandidates(pc);
        for (const transceiver of pc.getTransceivers()) {
          transceiver.direction = "sendrecv";
          await transceiver.sender.replaceTrack(
            this.stream
              .getTracks()
              .find(
                (track) => track.kind === transceiver.receiver.track.kind,
              ) || null,
          );
          if (this.pc !== pc) return;
        }
        await pc.setLocalDescription(await pc.createAnswer());
        sendDescription(pc);
      } catch {}
      return;
    }
    if (description?.type === "answer" && net.snapshot.role === 0) {
      const pc = this.pc;
      // Answers from a replaced connection must never complete a newer offer.
      if (
        !pc ||
        pc.signalingState !== "have-local-offer" ||
        (session && session !== this.session)
      )
        return;
      try {
        await pc.setRemoteDescription(description);
        if (this.pc === pc) await this.flushCandidates(pc);
      } catch {}
      return;
    }
    if (data.candidate) {
      if (session && this.retiredSessions.has(session)) return;
      const pc = this.pc;
      // ICE can precede SDP. Keep a bounded per-session queue; a candidate from
      // another negotiation is never fed into the currently connected peer.
      if (pc?.remoteDescription && (!session || session === this.session)) {
        await pc.addIceCandidate(data.candidate).catch(() => {});
      } else {
        this.pending.push({ candidate: data.candidate, session });
        if (this.pending.length > 64) this.pending.shift();
      }
    }
  }
  async flushCandidates(pc: RTCPeerConnection) {
    const matching = this.pending.filter(
      (item) => !item.session || item.session === this.session,
    );
    this.pending = [];
    for (const item of matching) {
      if (this.pc !== pc) return;
      await pc.addIceCandidate(item.candidate).catch(() => {});
    }
  }
  disconnect() {
    this.generation++;
    this.starting = false;
    if (this.session) {
      this.retiredSessions.add(this.session);
      if (this.retiredSessions.size > 32)
        this.retiredSessions.delete(
          this.retiredSessions.values().next().value!,
        );
    }
    this.session = "";
    this.healthy = false;
    this.pc?.close();
    this.pc = null;
    net.fast = null;
    this.pending = [];
    this.remote = new MediaStream();
    this.audio.srcObject = null;
    this.frame = "";
    this.mode = "relay";
    this.change();
  }
  stop() {
    this.disable("camera");
    this.disable("mic");
    this.disconnect();
    clearInterval(this.timer);
    clearInterval(this.healthTimer);
    this.timer = 0;
    this.healthTimer = 0;
    void this.ctx?.close();
    this.ctx = null;
  }
}
export const media = new Media();
