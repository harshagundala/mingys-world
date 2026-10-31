import { useEffect, useRef } from "react";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import { displayCadence } from "./displayCadence";

/** Shared with the water's onBeforeRender; changing cadence does not reallocate GPU targets. */
export const renderBudget = {
  reflectionIntervalMs: 40,
  shadowIntervalMs: 33,
  pressure: 0,
};
type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type PendingTimer = { query: WebGLQuery; epoch: number };

export function RenderBudget({
  quality,
  scenePhase,
  onDprChange,
  onFrameloopChange,
}: {
  quality: string;
  scenePhase: number;
  onDprChange: (dpr: number) => void;
  onFrameloopChange: (mode: "always" | "never") => void;
}) {
  const { gl, size, setDpr, setFrameloop, clock, invalidate } = useThree();
  const stats = useRef({
    warm: 0,
    seconds: 0,
    frames: [] as number[],
    fast: 0,
    shadowAt: -Infinity,
    lastAdjust: -Infinity,
  });
  const desired = useRef(1);
  const gpu = useRef({
    driver: null as null | {
      context: WebGL2RenderingContext;
      extension: TimerExtension;
    },
    active: null as PendingTimer | null,
    pending: null as PendingTimer | null,
    epoch: 0,
    frames: 0,
    nextFrame: 0,
    probes: 0,
    firstProbeAt: 0,
    sampleAt: 0,
    cpuFrameStart: 0,
    cpuMs: null as number | null,
    ms: null as number | null,
    samples: [] as number[],
  });
  const maxPixels =
    quality === "low"
      ? 1_100_000
      : quality === "medium"
        ? 1_650_000
        : 2_600_000;
  const cap = Math.min(
    quality === "low" ? 1 : 1.5,
    window.devicePixelRatio || 1,
    Math.sqrt(maxPixels / Math.max(1, size.width * size.height)),
  );
  const floor = Math.min(0.72, cap);

  useEffect(() => {
    const dpr = Math.min(cap, quality === "high" ? 1.25 : 1);
    desired.current = dpr;
    setDpr(dpr);
    onDprChange(dpr);
    stats.current.fast = 0;
    stats.current.warm = 0;
    stats.current.frames = [];
    stats.current.seconds = 0;
    renderBudget.pressure = 0;
    renderBudget.reflectionIntervalMs =
      quality === "low" ? 100 : quality === "medium" ? 66 : 40;
    renderBudget.shadowIntervalMs = quality === "low" ? 66 : 33;
  }, [quality, cap, setDpr, onDprChange]);

  useEffect(() => {
    const timing = gpu.current;
    const context = gl.getContext() as WebGL2RenderingContext;
    const initialize = () => {
      const extension = context.getExtension(
        "EXT_disjoint_timer_query_webgl2",
      ) as TimerExtension | null;
      timing.driver = extension ? { context, extension } : null;
      timing.epoch++;
      timing.frames = timing.nextFrame = 0;
      timing.firstProbeAt = timing.sampleAt = 0;
      timing.cpuMs = null;
      stats.current.warm = stats.current.seconds = 0;
      stats.current.frames = [];
      gl.shadowMap.autoUpdate = false;
      gl.shadowMap.needsUpdate = true;
      if (import.meta.env.DEV) {
        gl.info.autoReset = false;
        const debug = (window as any).__autumn;
        if (debug) debug.renderInfo = gl.info;
      }
    };
    const release = () => {
      const extension = timing.driver?.extension;
      if (!context.isContextLost()) {
        if (
          timing.active &&
          extension &&
          context.getQuery(
            extension.TIME_ELAPSED_EXT,
            context.CURRENT_QUERY,
          ) === timing.active.query
        )
          context.endQuery(extension.TIME_ELAPSED_EXT);
        if (timing.active) context.deleteQuery(timing.active.query);
        if (timing.pending) context.deleteQuery(timing.pending.query);
      }
      timing.active = timing.pending = null;
      timing.samples = [];
      timing.ms = null;
      timing.driver = null;
      timing.cpuFrameStart = 0;
    };
    initialize();
    // Runs after every renderer/composer pass, including water reflections. It
    // does not take rendering ownership or add an extra render pass.
    const remove = addAfterEffect(() => {
      if (timing.cpuFrameStart) {
        const ms = performance.now() - timing.cpuFrameStart;
        timing.cpuFrameStart = 0;
        timing.cpuMs =
          timing.cpuMs === null ? ms : timing.cpuMs * 0.9 + ms * 0.1;
      }
      if (!timing.active || !timing.driver) return;
      const { extension } = timing.driver;
      if (context.isContextLost()) {
        release();
        return;
      }
      if (
        context.getQuery(extension.TIME_ELAPSED_EXT, context.CURRENT_QUERY) ===
        timing.active.query
      ) {
        context.endQuery(extension.TIME_ELAPSED_EXT);
        timing.pending = timing.active;
      } else context.deleteQuery(timing.active.query);
      timing.active = null;
    });
    gl.domElement.addEventListener("webglcontextlost", release);
    gl.domElement.addEventListener("webglcontextrestored", initialize);
    return () => {
      remove();
      gl.domElement.removeEventListener("webglcontextlost", release);
      gl.domElement.removeEventListener("webglcontextrestored", initialize);
      release();
    };
  }, [gl]);

  useEffect(() => {
    // A chapter may swap terrain, lighting and shaders; preserve established
    // resolution while the new scene warms up before evaluating sustained load.
    stats.current.warm = 0;
    stats.current.seconds = 0;
    stats.current.frames = [];
    stats.current.fast = 0;
    gpu.current.epoch++;
    gpu.current.frames = gpu.current.nextFrame = 0;
    gpu.current.firstProbeAt = gpu.current.sampleAt = 0;
    gpu.current.samples = [];
    gpu.current.ms = null;
    gpu.current.cpuMs = null;
  }, [scenePhase, quality, cap]);

  useEffect(() => {
    const oldShadowAuto = gl.shadowMap.autoUpdate,
      oldInfoAuto = gl.info.autoReset;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    // Counts now include the reflection + main + postprocessing passes, not just the final fullscreen triangle.
    if (import.meta.env.DEV) gl.info.autoReset = false;
    let elapsed = clock.elapsedTime;
    const visibility = () => {
      if (document.hidden) {
        elapsed = clock.elapsedTime;
        setFrameloop("never");
        onFrameloopChange("never");
      } else {
        setFrameloop("always");
        clock.elapsedTime = elapsed;
        onFrameloopChange("always");
        stats.current.warm = 0;
        stats.current.frames = [];
        stats.current.seconds = 0;
        gpu.current.epoch++;
        gpu.current.samples = [];
        gpu.current.ms = null;
        gpu.current.cpuMs = null;
        gpu.current.firstProbeAt = gpu.current.sampleAt = 0;
        gl.shadowMap.needsUpdate = true;
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    if (document.hidden) visibility();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      gl.shadowMap.autoUpdate = oldShadowAuto;
      gl.info.autoReset = oldInfoAuto;
    };
  }, [gl, clock, setFrameloop, onFrameloopChange, invalidate]);

  // Negative priority runs before scene controls and before the automatic renderer without taking ownership of rendering.
  useFrame((_, dt) => {
    const now = performance.now(),
      q = stats.current;
    gpu.current.cpuFrameStart = now;
    if (now - q.shadowAt >= renderBudget.shadowIntervalMs) {
      gl.shadowMap.needsUpdate = true;
      q.shadowAt = now;
    }
    if (import.meta.env.DEV) {
      const debug = (window as any).__autumn;
      if (debug)
        debug.frameCost = {
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          textures: gl.info.memory.textures,
          geometries: gl.info.memory.geometries,
        };
      gl.info.reset();
    }
    if (document.hidden || dt <= 0 || dt > 0.25) return;
    const timing = gpu.current;
    if (timing.driver && timing.pending) {
      const { context, extension } = timing.driver;
      const pending = timing.pending;
      const disjoint = context.getParameter(extension.GPU_DISJOINT_EXT);
      const ready = context.getQueryParameter(
        pending.query,
        context.QUERY_RESULT_AVAILABLE,
      );
      if (disjoint || ready) {
        if (!disjoint && ready && pending.epoch === timing.epoch) {
          const ms =
            context.getQueryParameter(pending.query, context.QUERY_RESULT) /
            1e6;
          if (Number.isFinite(ms) && ms > 0 && ms < 1000) {
            timing.samples.push(ms);
            if (timing.samples.length > 6) timing.samples.shift();
            const sorted = [...timing.samples].sort((a, b) => a - b);
            timing.ms = sorted[Math.ceil((sorted.length - 1) * 0.75)];
            timing.sampleAt = now;
          }
        } else if (disjoint) {
          timing.samples = [];
          timing.ms = null;
        }
        context.deleteQuery(pending.query);
        timing.pending = null;
      }
    }
    q.warm += dt;
    if (q.warm < 4) return; // shader compilation, texture uploads and a newly visible tab are not sustained GPU load
    if (
      timing.driver &&
      ++timing.frames >= timing.nextFrame &&
      !timing.pending &&
      !timing.active
    ) {
      const { context, extension } = timing.driver;
      // Cooperate with browser profilers; WebGL permits only one elapsed query.
      if (
        !context.isContextLost() &&
        !context.getQuery(extension.TIME_ELAPSED_EXT, context.CURRENT_QUERY)
      ) {
        const query = context.createQuery();
        if (query) {
          context.beginQuery(extension.TIME_ELAPSED_EXT, query);
          timing.active = { query, epoch: timing.epoch };
          timing.firstProbeAt ||= now;
          // Vary the interval so probes do not always coincide with shadow updates.
          timing.nextFrame = timing.frames + 53 + ((timing.probes++ * 7) % 19);
        }
      }
    }
    q.seconds += dt;
    q.frames.push(dt * 1000);
    if (q.seconds < 2) return;
    const sorted = [...q.frames].sort((a, b) => a - b);
    const mean = (q.seconds * 1000) / q.frames.length,
      p95 = sorted[Math.floor((sorted.length - 1) * 0.95)];
    const targetMs = displayCadence.targetMs;
    const slow = mean > targetMs * 1.4 || p95 > targetMs * 2.04;
    const fast = mean < targetMs * 1.08 && p95 < targetMs * 1.38;
    const gpuFresh = timing.ms !== null && now - timing.sampleAt < 8000;
    const timerUnavailable =
      !timing.driver ||
      (timing.firstProbeAt > 0 &&
        now - (timing.sampleAt || timing.firstProbeAt) > 12000);
    const gpuOverloaded = gpuFresh
      ? timing.ms! > targetMs * 0.85
      : timerUnavailable;
    const canRaiseResolution = gpuFresh
      ? timing.ms! < targetMs * 0.7
      : timerUnavailable && fast;
    const cpuOverloaded =
      timing.cpuMs !== null && timing.cpuMs > targetMs * 0.7;
    const resourceHeadroom =
      gpuFresh &&
      timing.ms! < targetMs * 0.7 &&
      timing.cpuMs !== null &&
      timing.cpuMs < targetMs * 0.5;
    let next = desired.current;
    if (slow && (gpuOverloaded || cpuOverloaded || timerUnavailable))
      renderBudget.pressure = Math.min(2, renderBudget.pressure + 1);
    if (slow && gpuOverloaded && now - q.lastAdjust > 1800) {
      next = Math.max(floor, next - 0.12);
      q.fast = 0;
      q.lastAdjust = now;
    } else if (canRaiseResolution) {
      q.fast++;
      if (q.fast >= 4 && now - q.lastAdjust > 8000) {
        if ((fast || resourceHeadroom) && renderBudget.pressure > 0)
          renderBudget.pressure--;
        else next = Math.min(cap, next + 0.08);
        q.fast = 0;
        q.lastAdjust = now;
      }
    } else q.fast = 0;
    renderBudget.reflectionIntervalMs =
      (quality === "low" ? 100 : quality === "medium" ? 66 : 40) +
      renderBudget.pressure * 24;
    renderBudget.shadowIntervalMs =
      (quality === "low" ? 66 : 33) + renderBudget.pressure * 8;
    next = Math.min(cap, Math.round(next * 100) / 100);
    if (Math.abs(next - desired.current) > 0.025) {
      desired.current = next;
      setDpr(next);
      onDprChange(next);
      // Judge each resolution on its own cost; old high-resolution samples must
      // not trigger repeated reductions after the framebuffer has become cheaper.
      timing.epoch++;
      timing.samples = [];
      timing.ms = null;
      timing.firstProbeAt = timing.sampleAt = 0;
      timing.nextFrame = timing.frames + 10; // let resized targets settle first
    }
    if (import.meta.env.DEV) {
      const debug = (window as any).__autumn;
      if (debug)
        Object.assign(debug, {
          fps: Math.round(1000 / mean),
          pixelRatio: gl.getPixelRatio(),
          renderBudget: {
            meanMs: +mean.toFixed(2),
            p95Ms: +p95.toFixed(2),
            targetMs: +targetMs.toFixed(2),
            cadenceCalibrated: displayCadence.calibrated,
            cadenceSamples: displayCadence.samples,
            gpuTimerSupported: !!timing.driver,
            gpuMs: timing.ms === null ? null : +timing.ms.toFixed(2),
            cpuFrameMs: timing.cpuMs === null ? null : +timing.cpuMs.toFixed(2),
            gpuSamples: timing.samples.length,
            gpuFresh: timing.ms !== null && now - timing.sampleAt < 8000,
            dpr: gl.getPixelRatio(),
            cap: +cap.toFixed(2),
            pressure: renderBudget.pressure,
            reflectionIntervalMs: renderBudget.reflectionIntervalMs,
            shadowIntervalMs: renderBudget.shadowIntervalMs,
          },
        });
    }
    q.frames = [];
    q.seconds = 0;
  }, -100);
  return null;
}
