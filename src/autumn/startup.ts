let world: Promise<typeof import("./World")> | undefined;
let assets: Promise<void> | undefined;

/** The lobby and React.lazy share a single fetch/evaluation of the renderer. */
export function loadAutumnWorld() {
  return (world ||= import("./World").catch((error) => {
    world = undefined;
    throw error;
  }));
}

/** Downloads only. No Canvas, room admission, camera, microphone, or audio. */
export function warmAutumnWorld() {
  void loadAutumnWorld().catch(() => {});
  assets ||= import("./preloadAssets")
    .then(({ preloadAutumnAssets }) => preloadAutumnAssets())
    .catch(() => {
      assets = undefined;
    });
}
