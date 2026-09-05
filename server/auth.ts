import { createHmac, timingSafeEqual } from "node:crypto";
export function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function sessionToken() {
  return createHmac(
    "sha256",
    process.env.WORLD_SECRET?.trim() || "unconfigured",
  )
    .update("mingys-world-session-v1")
    .digest("hex");
}
export function authorized(req: { headers: any }) {
  const cookie =
    String(req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("mingy_session="))
      ?.split("=")[1] || "";
  return !!process.env.WORLD_SECRET && safeEqual(cookie, sessionToken());
}
