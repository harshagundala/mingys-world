export const input = {
  keys: new Set<string>(),
  yaw: 0,
  pitch: 0,
  blocked: true,
  look: false,
  touch: { x: 0, z: 0 },
  third: false,
  sensitivity: 1,
  holding: 0,
  jumpQueued: false,
};
export function setupInput(
  onAction: (down: boolean) => void,
  onHelp: () => void,
  onPing: () => void,
) {
  const down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.matches("input,textarea,select")) return;
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === "Space" && !input.blocked) input.jumpQueued = true;
    if (e.code === "KeyE" && !input.blocked) onAction(true);
    if (e.code === "KeyH" || e.code === "KeyJ") onHelp();
    if (e.code === "KeyQ" && !input.blocked) onPing();
    if (e.code === "KeyV") input.third = !input.third;
  };
  const up = (e: KeyboardEvent) => {
    input.keys.delete(e.code);
    if (e.code === "KeyE") onAction(false);
  };
  const reset = () => {
    input.keys.clear();
    input.touch = { x: 0, z: 0 };
    input.look = false;
    input.holding = 0;
    input.jumpQueued = false;
  };
  const move = (e: MouseEvent) => {
    if (input.blocked) return;
    if (document.pointerLockElement || input.look) {
      input.yaw -= e.movementX * 0.0022 * input.sensitivity;
      input.pitch = Math.max(
        -1.15,
        Math.min(1.15, input.pitch - e.movementY * 0.002 * input.sensitivity),
      );
    }
  };
  const mouseup = () => (input.look = false);
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", mouseup);
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", reset);
  return () => {
    reset();
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", mouseup);
    window.removeEventListener("blur", reset);
    document.removeEventListener("visibilitychange", reset);
  };
}
