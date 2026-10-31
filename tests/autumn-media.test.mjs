import test from "node:test";
import { setMaxListeners } from "node:events";
import assert from "node:assert/strict";

class Stream {
  constructor(tracks = []) {
    this.tracks = [...tracks];
  }
  getTracks() {
    return [...this.tracks];
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
  addTrack(track) {
    this.tracks.push(track);
  }
  removeTrack(track) {
    this.tracks = this.tracks.filter((t) => t !== track);
  }
}
class Peer {
  static all = [];
  constructor() {
    this.id = Peer.all.length;
    Peer.all.push(this);
    this.signalingState = "stable";
    this.connectionState = "new";
    this.localDescription = null;
    this.remoteDescription = null;
    this.transceivers = [];
    this.candidates = [];
    this.closed = false;
  }
  addTransceiver(kind) {
    const t = {
      direction: "sendrecv",
      receiver: { track: { kind } },
      sender: {
        track: null,
        async replaceTrack(track) {
          this.track = track;
        },
      },
    };
    this.transceivers.push(t);
    return t;
  }
  getTransceivers() {
    return this.transceivers;
  }
  createDataChannel() {
    return { readyState: "connecting" };
  }
  async createOffer() {
    return { type: "offer", sdp: `offer-${this.id}` };
  }
  async createAnswer() {
    return { type: "answer", sdp: `answer-${this.id}` };
  }
  async setLocalDescription(d) {
    assert.equal(this.closed, false);
    this.localDescription = d;
    this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
  }
  async setRemoteDescription(d) {
    assert.equal(this.closed, false);
    this.remoteDescription = d;
    this.signalingState = d.type === "offer" ? "have-remote-offer" : "stable";
    if (d.type === "offer" && !this.transceivers.length) {
      this.addTransceiver("audio");
      this.addTransceiver("video");
    }
  }
  async addIceCandidate(c) {
    this.candidates.push(c);
  }
  async getStats() {
    return new Map();
  }
  close() {
    this.closed = true;
    this.signalingState = "closed";
    this.connectionState = "closed";
  }
}
globalThis.MediaStream = Stream;
globalThis.RTCPeerConnection = Peer;
globalThis.window = {
  setInterval() {
    return 1;
  },
};
globalThis.document = {
  createElement() {
    return {
      async play() {},
      getContext() {
        return { drawImage() {} };
      },
      toDataURL() {
        return "";
      },
    };
  },
};
const { net } = await import("../src/autumn/network.ts");
const { Media } = await import("../src/autumn/media.ts");
// Independent Media fixtures share the mocked network; production has one instance.
setMaxListeners(32, net);
let sent = [];
net.send = (m) => {
  sent.push(m);
  return true;
};
function setup(role) {
  sent = [];
  net.snapshot = { ...net.snapshot, status: "connected", peer: true, role };
  return new Media();
}
const offer = (session = "offer-session-a", sdp = "same-offer") => ({
  session,
  description: { type: "offer", sdp },
});
const candidate = (session, id) => ({
  session,
  candidate: { candidate: `candidate:${id}` },
});

test("answerer never requests an offer while accepting an offer, including duplicate delivery", async () => {
  const m = setup(1);
  await m.connect();
  assert.equal(sent.filter((x) => x.data?.requestOffer).length, 1);
  sent = [];
  await m.signal(offer());
  const original = m.pc,
    count = Peer.all.length;
  assert.equal(original.signalingState, "stable");
  assert.equal(sent.filter((x) => x.data?.requestOffer).length, 0);
  for (let i = 0; i < 30; i++) await m.signal(offer());
  assert.equal(m.pc, original);
  assert.equal(Peer.all.length, count);
  assert.equal(sent.filter((x) => x.data?.requestOffer).length, 0);
  assert.equal(
    sent.filter((x) => x.data?.description?.type === "answer").length,
    31,
  );
  assert.ok(sent.every((x) => x.data?.session === "offer-session-a"));
  // A genuinely new offer replaces exactly one peer without starting feedback.
  await m.signal(offer("offer-session-b", "new-offer"));
  assert.notEqual(m.pc, original);
  assert.equal(original.closed, true);
  assert.equal(Peer.all.length, count + 1);
  assert.equal(sent.filter((x) => x.data?.requestOffer).length, 0);
  m.disconnect();
});

test("camera and microphone enabled before join are attached when answering", async () => {
  const m = setup(1),
    video = { kind: "video" },
    audio = { kind: "audio" };
  m.stream = new Stream([video, audio]);
  m.cameraOn = m.micOn = true;
  await m.signal(offer());
  assert.equal(sent.filter((x) => x.data?.requestOffer).length, 0);
  assert.deepEqual(
    m.pc
      .getTransceivers()
      .map((t) => t.sender.track)
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    [audio, video],
  );
  const original = m.pc;
  await m.signal(offer());
  assert.equal(m.pc, original);
  m.disconnect();
});

test("caller reuses its pending offer and deduplicates requests after connection", async () => {
  const m = setup(0);
  await m.connect();
  const original = m.pc,
    session = m.session;
  await m.signal({ requestOffer: true, requestId: "request-a" });
  assert.equal(m.pc, original);
  await m.signal({ description: { type: "answer", sdp: "answer-a" }, session });
  original.connectionState = "connected";
  await m.signal({ requestOffer: true, requestId: "request-a" });
  assert.equal(m.pc, original);
  // A newly refreshed answerer requests a fresh connection.
  await m.signal({ requestOffer: true, requestId: "request-b" });
  assert.notEqual(m.pc, original);
  assert.equal(original.closed, true);
  assert.notEqual(m.session, session);
  m.disconnect();
});

test("stale answers and ICE cannot enter a replacement negotiation", async () => {
  const m = setup(0);
  await m.connect();
  const oldSession = m.session;
  await m.connect();
  const current = m.pc,
    newSession = m.session;
  await m.signal({
    description: { type: "answer", sdp: "old-answer" },
    session: oldSession,
  });
  assert.equal(current.remoteDescription, null);
  await m.signal(candidate(oldSession, "old"));
  await m.signal(candidate(newSession, "current"));
  assert.equal(current.candidates.length, 0);
  await m.signal({
    description: { type: "answer", sdp: "new-answer" },
    session: newSession,
  });
  assert.equal(current.remoteDescription.sdp, "new-answer");
  assert.deepEqual(current.candidates, [{ candidate: "candidate:current" }]);
  m.disconnect();
});

test("answerer queues ICE before SDP and ignores replay of a retired offer", async () => {
  const m = setup(1);
  await m.signal(candidate("offer-session-a", "early"));
  assert.equal(m.pc, null);
  assert.equal(m.pending.length, 1);
  await m.signal(offer());
  assert.deepEqual(m.pc.candidates, [{ candidate: "candidate:early" }]);
  const first = m.pc;
  await m.signal(candidate("offer-session-b", "next"));
  assert.equal(first.candidates.length, 1);
  await m.signal(offer("offer-session-b", "new-offer"));
  assert.deepEqual(m.pc.candidates, [{ candidate: "candidate:next" }]);
  const second = m.pc;
  await m.signal(offer());
  await m.signal(candidate("offer-session-a", "late"));
  assert.equal(m.pc, second);
  assert.equal(second.candidates.length, 1);
  m.disconnect();
});

test("legacy untagged SDP remains usable and duplicate legacy offers are idempotent", async () => {
  const m = setup(1);
  const legacy = { description: { type: "offer", sdp: "legacy" } };
  await m.signal(legacy);
  const original = m.pc;
  await m.signal(legacy);
  await m.signal({ candidate: { candidate: "legacy-candidate" } });
  assert.equal(m.pc, original);
  assert.equal(original.candidates.length, 1);
  assert.equal(sent.filter((x) => x.data?.requestOffer).length, 0);
  m.disconnect();
});

test("ICE-enriched retransmissions retain the same tagged session and peer", async () => {
  const m = setup(1);
  const originalSDP =
    "v=0\r\no=- 123 1 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=ice-ufrag:abc\r\na=fingerprint:sha-256 FIRST\r\n";
  await m.signal(offer("session-enriched", originalSDP));
  const peer = m.pc,
    count = Peer.all.length;
  for (let i = 0; i < 20; i++)
    await m.signal(
      offer(
        "session-enriched",
        originalSDP +
          `a=candidate:${i} 1 udp 123 192.0.2.1 5555 typ host\r\na=end-of-candidates\r\n`,
      ),
    );
  assert.equal(m.pc, peer);
  assert.equal(Peer.all.length, count);
  assert.equal(m.retiredSessions.has("session-enriched"), false);
  await m.signal(candidate("session-enriched", "still-current"));
  assert.deepEqual(peer.candidates, [{ candidate: "candidate:still-current" }]);
  m.disconnect();
});

test("legacy SDP identity ignores gathered candidates but retains ICE restart credentials", async () => {
  const m = setup(1);
  const originalSDP =
    "v=0\r\no=- 123 1 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:abc\r\na=ice-pwd:original-password\r\na=fingerprint:sha-256 FIRST\r\n";
  await m.signal({ description: { type: "offer", sdp: originalSDP } });
  const peer = m.pc;
  const enriched =
    originalSDP
      .replace("m=audio 9", "m=audio 5555")
      .replace("c=IN IP4 0.0.0.0", "c=IN IP4 192.0.2.1")
      .replace("a=rtcp:9 IN IP4 0.0.0.0", "a=rtcp:5556 IN IP4 192.0.2.1") +
    "a=candidate:1 1 udp 123 192.0.2.1 5555 typ host\r\na=end-of-candidates\r\n";
  await m.signal({ description: { type: "offer", sdp: enriched } });
  assert.equal(m.pc, peer);
  await m.signal({
    description: {
      type: "offer",
      sdp: enriched
        .replace("ice-ufrag:abc", "ice-ufrag:new")
        .replace("original-password", "new-password"),
    },
  });
  assert.notEqual(m.pc, peer);
  assert.equal(peer.closed, true);
  m.disconnect();
});

test("lobby capture and joining reuse one camera or microphone track, including concurrent calls", async () => {
  const m = setup(1);
  m.unlock = async () => {};
  m.captureVoice = () => {};
  let captures = 0,
    finish;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia() {
          captures++;
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
    },
  });
  for (const kind of ["camera", "mic"]) {
    const first = m.enable(kind),
      second = m.enable(kind);
    assert.equal(first, second);
    await Promise.resolve();
    const track = {
      kind: kind === "camera" ? "video" : "audio",
      readyState: "live",
      addEventListener() {},
      stop() {
        this.readyState = "ended";
      },
    };
    finish(new Stream([track]));
    await Promise.all([first, second]);
    await m.enable(kind); // joining restores a preference already enabled in lobby
    assert.equal(
      m.stream.getTracks().filter((t) => t.kind === track.kind).length,
      1,
    );
    assert.equal(m.captures[kind], undefined);
  }
  assert.equal(captures, 2);
  assert.equal(m.stream.getTracks().length, 2);
  m.disconnect();
});

test("failed capture clears its in-flight entry so a later permission retry works", async () => {
  const m = setup(1);
  m.unlock = async () => {};
  let attempts = 0;
  const track = {
    kind: "video",
    readyState: "live",
    addEventListener() {},
    stop() {},
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          if (++attempts === 1)
            throw Object.assign(new Error("blocked"), {
              name: "NotAllowedError",
            });
          return new Stream([track]);
        },
      },
    },
  });
  await assert.rejects(m.enable("camera"), /permission is blocked/);
  assert.equal(m.captures.camera, undefined);
  await m.enable("camera");
  assert.equal(attempts, 2);
  assert.equal(m.stream.getVideoTracks().length, 1);
  m.disconnect();
});
