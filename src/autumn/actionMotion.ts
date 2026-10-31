const clamp = (value: number) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
/** Anticipation, quick contact, then a damped rebound. Never cycles on old gestures. */
export function toolImpact(age: number) {
  if (!Number.isFinite(age) || age < 0 || age >= 0.78) return 0;
  if (age < 0.11) return -0.22 * smooth(age / 0.11);
  if (age < 0.21) return -0.22 + 1.22 * smooth((age - 0.11) / 0.1);
  const t = age - 0.21;
  return Math.exp(-8 * t) * Math.cos(t * 12) * (1 - smooth((age - 0.58) / 0.2));
}
/** The in-hand pumpkin must leave when the authoritative world projectile is thrown. */
export function throwHandling(age: number, holdingMs: number) {
  const charging = holdingMs > 0;
  const released = !charging && Number.isFinite(age) && age >= 0 && age < 1;
  const follow = released
    ? Math.sin((clamp(age / 0.16) * Math.PI) / 2) *
      Math.exp(-Math.max(0, age - 0.16) * 8)
    : 0;
  return {
    draw: charging ? smooth(holdingMs / 1300) : 0,
    follow,
    open: released
      ? Math.sin(clamp(age / 0.42) * Math.PI) *
        (1 - smooth((age - 0.42) / 0.25))
      : 0,
    objectVisible: !released || age >= 0.56,
    reveal: released ? smooth((age - 0.56) / 0.28) : 1,
  };
}
export function harvestHandling(holdingMs: number, releaseAge: number) {
  if (holdingMs > 0)
    return {
      reach: smooth(holdingMs / 420),
      twist: Math.sin(holdingMs * 0.006) * 0.09,
    };
  if (!Number.isFinite(releaseAge) || releaseAge < 0 || releaseAge > 0.65)
    return { reach: 0, twist: 0 };
  return {
    reach: 1 - smooth(releaseAge / 0.65),
    twist: Math.sin((releaseAge / 0.65) * Math.PI) * 0.14,
  };
}
