class Soundscape {
  ctx: AudioContext | null = null;
  gain: GainNode | null = null;
  enabled = true;
  timer = 0;
  phase = 0;
  beat = 0;
  noise: AudioBuffer | null = null;
  start() {
    this.ctx ||= new AudioContext();
    if (!this.gain) {
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.13;
      this.gain.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    if (!this.timer) this.timer = window.setInterval(() => this.music(), 1700);
  }
  note(
    freq: number,
    duration: number,
    volume = 0.2,
    type: OscillatorType = "sine",
    delay = 0,
  ) {
    if (!this.enabled || !this.ctx || !this.gain) return;
    const t = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.gain);
    o.start(t);
    o.stop(t + duration + 0.1);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  music() {
    const chords = [
      [146.83, 220, 293.66, 369.99],
      [130.81, 196, 261.63, 329.63],
      [174.61, 261.63, 349.23, 440],
      [164.81, 246.94, 329.63, 392],
    ];
    const chord = chords[Math.floor(this.beat / 8) % 4];
    if (this.beat % 4 === 0)
      chord
        .slice(0, 3)
        .forEach((n, i) => this.note(n, 6, 0.08, "sine", i * 0.12));
    this.note(
      chord[(this.beat * 3) % 4] * (this.phase > 4 ? 2 : 1),
      2.6,
      0.13,
      "sine",
    );
    if (this.beat % 3 === 0) this.note(chord[3] * 2, 3, 0.04, "sine", 0.6);
    this.beat++;
  }
  chime() {
    [440, 554.37, 659.25].forEach((n, i) =>
      this.note(n, 0.8, 0.28, "sine", i * 0.09),
    );
  }
  step() {
    this.note(65 + Math.random() * 20, 0.07, 0.09, "triangle");
    if (!this.enabled || !this.ctx || !this.gain) return;
    if (!this.noise) {
      this.noise = this.ctx.createBuffer(
        1,
        Math.floor(this.ctx.sampleRate * 0.18),
        this.ctx.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp((-i / data.length) * 5);
    }
    const source = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain();
    source.buffer = this.noise;
    source.playbackRate.value = 0.8 + Math.random() * 0.4;
    filter.type = "lowpass";
    filter.frequency.value = 1700;
    gain.gain.value = 0.11;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.gain);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  tap() {
    this.note(180, 0.12, 0.3, "triangle");
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.gain && this.ctx)
      this.gain.gain.setTargetAtTime(
        this.enabled ? 0.13 : 0,
        this.ctx.currentTime,
        0.2,
      );
    if (this.enabled) this.start();
    return this.enabled;
  }
  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    void this.ctx?.close();
    this.ctx = null;
    this.gain = null;
  }
}
export const sound = new Soundscape();
