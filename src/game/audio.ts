/** Original adaptive score: felt piano, glass harmonics, warm strings and a quiet pulse. */
let ctx: AudioContext | null = null,
  master: GainNode | null = null,
  dry: GainNode | null = null,
  wet: GainNode | null = null;
let enabled = false,
  timer = 0,
  next = 0,
  tick = 0,
  place = "house",
  chapter = 0,
  active = 0;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const themes: Record<
  string,
  { tempo: number; chords: number[][]; melody: (number | null)[] }
> = {
  house: {
    tempo: 72,
    chords: [
      [50, 57, 61, 64],
      [47, 54, 57, 62],
      [43, 50, 54, 59],
      [45, 52, 57, 61],
    ],
    melody: [
      69,
      null,
      66,
      64,
      62,
      null,
      66,
      69,
      73,
      null,
      71,
      69,
      66,
      null,
      64,
      null,
    ],
  },
  loft: {
    tempo: 74,
    chords: [
      [47, 54, 57, 61],
      [43, 50, 54, 57],
      [50, 57, 61, 64],
      [45, 52, 55, 61],
    ],
    melody: [
      66,
      null,
      69,
      73,
      71,
      null,
      69,
      66,
      64,
      null,
      62,
      66,
      61,
      null,
      64,
      null,
    ],
  },
  garden: {
    tempo: 68,
    chords: [
      [43, 50, 54, 57],
      [50, 57, 61, 66],
      [47, 54, 57, 62],
      [45, 52, 57, 64],
    ],
    melody: [
      74,
      null,
      73,
      69,
      66,
      null,
      64,
      null,
      69,
      null,
      71,
      74,
      73,
      null,
      69,
      null,
    ],
  },
  dream: {
    tempo: 66,
    chords: [
      [50, 57, 62, 66],
      [46, 53, 58, 62],
      [43, 50, 55, 59],
      [45, 52, 57, 64],
    ],
    melody: [
      81,
      null,
      78,
      74,
      73,
      78,
      null,
      81,
      82,
      null,
      77,
      74,
      69,
      null,
      73,
      null,
    ],
  },
  lab: {
    tempo: 84,
    chords: [
      [47, 54, 58, 61],
      [43, 50, 54, 58],
      [40, 47, 52, 55],
      [42, 49, 54, 58],
    ],
    melody: [
      71,
      null,
      66,
      null,
      70,
      66,
      null,
      61,
      67,
      null,
      64,
      null,
      66,
      null,
      61,
      null,
    ],
  },
  observatory: {
    tempo: 64,
    chords: [
      [50, 57, 61, 66],
      [54, 61, 64, 69],
      [43, 50, 54, 59],
      [45, 52, 57, 64],
    ],
    melody: [
      78,
      null,
      76,
      73,
      74,
      null,
      69,
      null,
      73,
      null,
      78,
      81,
      78,
      null,
      74,
      null,
    ],
  },
};
function voice(
  note: number,
  at: number,
  duration: number,
  velocity: number,
  kind: "piano" | "glass" | "pad" | "pulse" = "piano",
) {
  if (!ctx || !dry || !wet || active > 120) return;
  const envelope = ctx.createGain(),
    pan = ctx.createStereoPanner();
  pan.pan.value = Math.sin(note * 3.7) * 0.3;
  envelope.connect(pan);
  pan.connect(dry);
  pan.connect(wet);
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(
    velocity,
    at + (kind === "pad" ? 0.7 : 0.008),
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  const partials =
    kind === "piano"
      ? [1, 2, 3, 4]
      : kind === "glass"
        ? [1, 2.76, 5.4]
        : kind === "pad"
          ? [1, 1.002]
          : [1];
  let live = partials.length;
  for (const [i, partial] of partials.entries()) {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = kind === "pulse" ? "triangle" : "sine";
    o.frequency.value = midi(note) * partial;
    g.gain.value = kind === "pad" ? 0.5 : 1 / Math.pow(i + 1, 2.3);
    o.connect(g);
    g.connect(envelope);
    o.start(at);
    o.stop(at + duration + 0.03);
    active++;
    o.onended = () => {
      active--;
      o.disconnect();
      g.disconnect();
      if (--live === 0) {
        envelope.disconnect();
        pan.disconnect();
      }
    };
  }
}
function init() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.32;
  dry = ctx.createGain();
  dry.gain.value = 0.8;
  wet = ctx.createGain();
  wet.gain.value = 0.3;
  const reverb = ctx.createConvolver(),
    length = ctx.sampleRate * 2.7,
    impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  let seed = 91;
  for (let ch = 0; ch < 2; ch++) {
    const a = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      a[i] =
        ((seed / 4294967296) * 2 - 1) * Math.pow(1 - i / length, 3.5) * 0.38;
    }
  }
  reverb.buffer = impulse;
  wet.connect(reverb);
  reverb.connect(master);
  dry.connect(master);
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 3;
  master.connect(compressor);
  compressor.connect(ctx.destination);
  document.addEventListener("visibilitychange", () => {
    if (ctx && master)
      master.gain.setTargetAtTime(
        enabled && !document.hidden ? 0.32 : 0,
        ctx.currentTime,
        0.2,
      );
  });
}
function schedule() {
  if (!ctx || !enabled) return;
  const theme = themes[place] || themes.house,
    tense = chapter === 5,
    beat = 60 / (tense ? 104 : theme.tempo) / 2;
  while (next < ctx.currentTime + 0.18) {
    const bar = Math.floor(tick / 8),
      step = tick % 8,
      chord = theme.chords[Math.floor(bar / 2) % 4];
    if (step === 0) {
      chord
        .slice(0, 3)
        .forEach((n, i) => voice(n, next + i * 0.018, beat * 10, 0.043, "pad"));
      voice(chord[0] - 12, next, beat * 5, 0.1, "piano");
    }
    const melody = theme.melody[tick % theme.melody.length];
    if (melody !== null)
      voice(
        melody + (bar % 8 === 7 ? 12 : 0),
        next,
        2.5,
        0.115,
        place === "dream" ? "glass" : "piano",
      );
    if (step % 2 === 1)
      voice(chord[(step + bar) % chord.length] + 12, next, 1.8, 0.05, "piano");
    if ((place === "dream" || place === "observatory") && step === 6)
      voice(chord[2] + 24, next + 0.08, 3.8, 0.036, "glass");
    if (tense && step % 2 === 0)
      voice(chord[0] - 12, next, 0.13, 0.075, "pulse");
    next += beat;
    tick++;
  }
}
export function setMusicScene(nextPlace: string, nextChapter: number) {
  place = nextPlace;
  chapter = nextChapter;
}
export async function toggleAudio() {
  init();
  enabled = !enabled;
  if (!ctx || !master) return false;
  await ctx.resume();
  master.gain.setTargetAtTime(enabled ? 0.32 : 0, ctx.currentTime, 0.2);
  clearInterval(timer);
  if (enabled) {
    next = ctx.currentTime + 0.08;
    tick = 0;
    timer = window.setInterval(schedule, 80);
    schedule();
  }
  return enabled;
}
export function sound(kind: "clue" | "success" | "bark" | "click" = "click") {
  if (!enabled || !ctx) return;
  const at = ctx.currentTime;
  if (kind === "bark") {
    voice(54, at, 0.11, 0.25, "pulse");
    voice(49, at + 0.13, 0.15, 0.18, "pulse");
    return;
  }
  const notes =
    kind === "success" ? [62, 66, 69, 74] : kind === "clue" ? [78, 81] : [69];
  notes.forEach((n, i) =>
    voice(n, at + i * 0.12, kind === "success" ? 2.2 : 1.1, 0.15, "glass"),
  );
}
export function audioStatus() {
  return {
    enabled,
    state: ctx?.state || "uninitialized",
    activeVoices: active,
    place,
    chapter,
  };
}
