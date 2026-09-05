let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let timer = 0;
let enabled = false;
export function sound(kind: "clue" | "success" | "bark" | "click" = "click") {
  if (!enabled || !ctx || !gain) return;
  const now = ctx.currentTime;
  const notes =
    kind === "success"
      ? [392, 493.88, 587.33, 783.99]
      : kind === "clue"
        ? [523.25, 659.25]
        : kind === "bark"
          ? [190, 125]
          : [440];
  notes.forEach((f, i) => {
    const o = ctx!.createOscillator(),
      g = ctx!.createGain();
    o.type = kind === "bark" ? "triangle" : "sine";
    o.frequency.setValueAtTime(f, now + i * 0.11);
    if (kind === "bark")
      o.frequency.exponentialRampToValueAtTime(f * 0.4, now + i * 0.11 + 0.13);
    g.gain.setValueAtTime(0, now + i * 0.11);
    g.gain.linearRampToValueAtTime(
      kind === "bark" ? 0.14 : 0.12,
      now + i * 0.11 + 0.012,
    );
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.6);
    o.connect(g);
    g.connect(gain!);
    o.start(now + i * 0.11);
    o.stop(now + i * 0.11 + 0.65);
  });
}
export async function toggleAudio() {
  enabled = !enabled;
  if (enabled) {
    ctx ??= new AudioContext();
    await ctx.resume();
    gain ??= ctx.createGain();
    gain.gain.value = 0.25;
    gain.connect(ctx.destination);
    let n = 0;
    timer = window.setInterval(() => {
      if (document.hidden) return;
      const notes = [196, 293.66, 246.94, 392, 329.63, 293.66, 220, 246.94];
      const o = ctx!.createOscillator(),
        g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = notes[n++ % notes.length];
      g.gain.setValueAtTime(0, ctx!.currentTime);
      g.gain.linearRampToValueAtTime(0.08, ctx!.currentTime + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + 3);
      o.connect(g);
      g.connect(gain!);
      o.start();
      o.stop(ctx!.currentTime + 3.1);
    }, 1800);
  } else {
    clearInterval(timer);
    if (gain) gain.gain.value = 0;
  }
  return enabled;
}
