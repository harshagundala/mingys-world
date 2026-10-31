import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { sound } from "./sound";
import { net } from "./network";
import { input } from "./controls";

/** Quiet, spatial environmental beds, below the music and the partner's separate voice path. */
export function WoodlandAudio({
  river,
  hollow = false,
}: {
  river: boolean;
  hollow?: boolean;
}) {
  const graph = useRef<{
    ctx: AudioContext;
    wind: GainNode;
    water: GainNode;
    pan: StereoPannerNode;
    at: number;
  } | null>(null);
  useEffect(() => {
    const ctx = sound.ctx,
      master = sound.gain;
    if (!ctx || !master) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      low = low * 0.965 + white * 0.035;
      data[i] = low * 2.7 + white * 0.12;
    }
    // Match the loop's ends so headphones never reveal a periodic click.
    const overlap = Math.round(ctx.sampleRate * 0.15);
    for (let i = 0; i < overlap; i++) {
      const t = i / overlap;
      data[data.length - overlap + i] =
        data[data.length - overlap + i] * (1 - t) + data[i] * t;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const windFilter = ctx.createBiquadFilter(),
      waterFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 1050;
    windFilter.Q.value = 0.45;
    waterFilter.type = "lowpass";
    waterFilter.frequency.value = 2100;
    const wind = ctx.createGain(),
      water = ctx.createGain(),
      pan = ctx.createStereoPanner();
    wind.gain.value = water.gain.value = 0;
    source.connect(windFilter).connect(wind).connect(master);
    source.connect(waterFilter).connect(water).connect(pan).connect(master);
    source.start();
    graph.current = { ctx, wind, water, pan, at: 0 };
    const visibility = () => {
      if (document.hidden) {
        wind.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
        water.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      graph.current = null;
      try {
        source.stop();
      } catch {
        /* The shared audio context may already be closed. */
      }
      [source, windFilter, waterFilter, wind, water, pan].forEach((n) =>
        n.disconnect(),
      );
    };
  }, []);
  useFrame(() => {
    const g = graph.current;
    if (!g || document.hidden || g.ctx.state !== "running") return;
    const t = g.ctx.currentTime;
    if (t - g.at < 0.1) return;
    g.at = t;
    const p = net.local;
    const bank = Math.abs(p.z + 68);
    const waterfall = Math.hypot(p.x - 94, p.z + 68);
    const waterLevel = hollow
      ? Math.max(0, 1 - Math.hypot(p.x + 48, p.z + 4) / 65) * 0.14
      : river
        ? 0.15
        : Math.max(0, 1 - bank / 28) * 0.085 +
          Math.max(0, 1 - waterfall / 65) * 0.16;
    const woodland = Math.max(0, Math.min(1, (-p.x - 8) / 35));
    const gust = 0.72 + Math.sin(t * 0.23) * 0.16 + Math.sin(t * 0.61) * 0.12;
    g.wind.gain.setTargetAtTime((0.045 + woodland * 0.045) * gust, t, 0.35);
    g.water.gain.setTargetAtTime(waterLevel, t, 0.6);
    const dx = (hollow ? -48 : 94) - p.x,
      dz = (hollow ? -4 : -68) - p.z;
    const right =
      (dx * Math.cos(input.yaw) - dz * Math.sin(input.yaw)) /
      Math.max(1, Math.hypot(dx, dz));
    g.pan.pan.setTargetAtTime(
      river ? Math.sin(t * 0.13) * 0.12 : right * 0.65,
      t,
      0.35,
    );
  });
  return null;
}
