export const controls = {
  keys: new Set<string>(),
  blocked: false,
  sniffUntil: 0,
  barkUntil: 0,
  jumpQueued: false,
  touch: { x: 0, z: 0 },
  interact: () => {},
  bark: () => {},
  zoom: 1,
  azimuth: 0,
};
export function setupControls() {
  const down = (e: KeyboardEvent) => {
    if (
      controls.blocked ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        e.code,
      )
    )
      e.preventDefault();
    controls.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "Space") controls.jumpQueued = true;
    if (e.code === "KeyE") controls.interact();
    if (e.code === "KeyQ") controls.sniffUntil = performance.now() + 5000;
    if (e.code === "KeyB") {
      controls.barkUntil = performance.now() + 1500;
      controls.bark();
    }
  };
  let dragging = false,
    lastX = 0;
  const pointerDown = (e: PointerEvent) => {
    if (e.button === 2 && !controls.blocked) {
      dragging = true;
      lastX = e.clientX;
    }
  };
  const pointerMove = (e: PointerEvent) => {
    if (dragging) {
      controls.azimuth -= (e.clientX - lastX) * 0.005;
      lastX = e.clientX;
    }
  };
  const pointerUp = () => {
    dragging = false;
  };
  const context = (e: MouseEvent) => {
    if (!controls.blocked) e.preventDefault();
  };
  window.addEventListener("pointerdown", pointerDown);
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("contextmenu", context);
  const up = (e: KeyboardEvent) => controls.keys.delete(e.code);
  const blur = () => {
    dragging = false;
    controls.keys.clear();
    controls.touch = { x: 0, z: 0 };
    controls.jumpQueued = false;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", blur);
  return () => {
    window.removeEventListener("pointerdown", pointerDown);
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", pointerUp);
    window.removeEventListener("contextmenu", context);
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    document.removeEventListener("visibilitychange", blur);
  };
}
