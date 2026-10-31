import type { Pose } from "./content";
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Receipt-time interpolation: independent of sender clock corrections and Redis timestamps. */
export class MotionBuffer {
  frames: { pose: Pose; at: number }[] = [];
  clear() {
    this.frames = [];
  }
  push(pose: Pose, at: number) {
    const last = this.frames.at(-1);
    if (last && pose.seq <= last.pose.seq && pose.scene === last.pose.scene)
      return false;
    if (
      last &&
      (pose.scene !== last.pose.scene ||
        Math.hypot(pose.x - last.pose.x, pose.z - last.pose.z) > 14)
    )
      this.clear();
    this.frames.push({ pose: { ...pose }, at });
    if (this.frames.length > 32) this.frames.shift();
    return true;
  }
  sample(now: number): Pose | undefined {
    const last = this.frames.at(-1);
    if (!last) return;
    const at = now - 100;
    for (let i = 1; i < this.frames.length; i++) {
      const a = this.frames[i - 1],
        b = this.frames[i];
      if (b.at < at) continue;
      const t = Math.max(
        0,
        Math.min(1, (at - a.at) / Math.max(1, b.at - a.at)),
      );
      return {
        ...b.pose,
        x: mix(a.pose.x, b.pose.x, t),
        y: mix(a.pose.y, b.pose.y, t),
        z: mix(a.pose.z, b.pose.z, t),
        yaw: a.pose.yaw + angleDelta(a.pose.yaw, b.pose.yaw) * t,
        pitch: mix(a.pose.pitch, b.pose.pitch, t),
      };
    }
    const prev = this.frames.at(-2),
      p = { ...last.pose };
    if (prev && p.moving && at > last.at && last.at - prev.at > 8) {
      const dt = (last.at - prev.at) / 1000,
        ahead = Math.min(0.12, (at - last.at) / 1000);
      const vx = (p.x - prev.pose.x) / dt,
        vz = (p.z - prev.pose.z) / dt;
      const cap = Math.min(1, 8 / Math.max(0.001, Math.hypot(vx, vz)));
      p.x += vx * cap * ahead;
      p.z += vz * cap * ahead;
    }
    if (now - last.at > 280) p.moving = false;
    return p;
  }
}
