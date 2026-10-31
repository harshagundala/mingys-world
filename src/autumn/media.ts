import { net } from "./network";
class Media extends EventTarget {
  stream = new MediaStream();
  remote = new MediaStream();
  pc: RTCPeerConnection | null = null;
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
  pending: RTCIceCandidateInit[] = [];
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
  async enable(kind: "camera" | "mic") {
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
  async connect() {
    if (
      this.starting ||
      !net.snapshot.peer ||
      net.snapshot.status !== "connected"
    )
      return;
    this.starting = true;
    this.disconnect();
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
          data: { candidate: e.candidate.toJSON(), generation },
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
        net.send({
          type: "rtc",
          data: { description: pc.localDescription, generation },
        });
      } else net.send({ type: "rtc", data: { requestOffer: true } });
    } catch {
    } finally {
      this.starting = false;
      this.announce();
    }
  }
  async signal(data: any) {
    if (!net.snapshot.peer) return;
    if (data.requestOffer && net.snapshot.role === 0) {
      if (Date.now() - this.lastOffer < 700 && this.pc?.localDescription)
        net.send({
          type: "rtc",
          data: { description: this.pc.localDescription },
        });
      else await this.connect();
      return;
    }
    if (data.description?.type === "offer" && net.snapshot.role === 1) {
      if (
        !this.pc ||
        (this.pc.signalingState === "stable" && this.pc.remoteDescription)
      ) {
        await this.connect();
      }
    }
    if (!this.pc) await this.connect();
    const pc = this.pc;
    if (!pc) return;
    try {
      if (data.description) {
        if (
          data.description.type === "answer" &&
          pc.signalingState !== "have-local-offer"
        )
          return;
        await pc.setRemoteDescription(data.description);
        for (const c of this.pending)
          await pc.addIceCandidate(c).catch(() => {});
        this.pending = [];
        if (data.description.type === "offer") {
          for (const t of pc.getTransceivers()) {
            t.direction = "sendrecv";
            await t.sender.replaceTrack(
              this.stream
                .getTracks()
                .find((x) => x.kind === t.receiver.track.kind) || null,
            );
          }
          await pc.setLocalDescription(await pc.createAnswer());
          net.send({ type: "rtc", data: { description: pc.localDescription } });
        }
      }
      if (data.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
        else this.pending.push(data.candidate);
      }
    } catch {}
  }
  disconnect() {
    this.generation++;
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
