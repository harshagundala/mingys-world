import test from "node:test";
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
