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
  const up = (e: KeyboardEvent) => controls.keys.delete(e.code);
  const blur = () => {
    controls.keys.clear();
    controls.touch = { x: 0, z: 0 };
    controls.jumpQueued = false;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    document.removeEventListener("visibilitychange", blur);
  };
}
