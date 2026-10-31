/** Measure the browser's display cadence in the lightweight lobby, before WebGL loads. */
export const displayCadence = {
  targetMs: 1000 / 60,
  calibrated: false,
  samples: 0,
};

const samples: number[] = [];
let frame = 0;
let previous = 0;
let finished = false;

export function finishDisplayCalibration() {
  if (finished) return;
  finished = true;
  cancelAnimationFrame(frame);
  displayCadence.samples = samples.length;
  if (samples.length < 20) return;
  const sorted = [...samples].sort((a, b) => a - b);
  // The fastest stable fifth ignores occasional busy lobby frames. Cap the
  // quality target at 60Hz even on 120Hz screens, and recognize 30Hz power saving.
  displayCadence.targetMs = Math.max(
    1000 / 60,
    Math.min(1000 / 30, sorted[Math.floor(sorted.length * 0.2)]),
  );
  displayCadence.calibrated = true;
}

function sample(now: number) {
  if (finished) return;
  const delta = now - previous;
  if (!document.hidden && previous && delta >= 5 && delta <= 70)
    samples.push(delta);
  previous = document.hidden ? 0 : now;
  if (samples.length >= 60) finishDisplayCalibration();
  else frame = requestAnimationFrame(sample);
}
frame = requestAnimationFrame(sample);
if (import.meta.hot) import.meta.hot.dispose(finishDisplayCalibration);
