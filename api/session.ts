import { authorized, safeEqual, sessionToken } from "../server/auth.ts";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const allowed = authorized(req);
    return res.status(200).json({
      authorized: allowed,
      ...(allowed && String(req.url).includes("invitation=1")
        ? { invite: process.env.WORLD_SECRET?.trim() }
        : {}),
    });
  }
  if (req.method !== "POST") return res.status(405).end();
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid invitation" });
    }
  }
  if (
    !process.env.WORLD_SECRET ||
    !safeEqual(String(body?.invite || ""), process.env.WORLD_SECRET.trim())
  )
    return res.status(401).json({
      error:
        "This invitation is not valid. Open the private link you were given.",
    });
  res.setHeader(
    "Set-Cookie",
    `mingy_session=${sessionToken()}; HttpOnly; Path=/; SameSite=Strict; Max-Age=604800${process.env.VERCEL ? "; Secure" : ""}`,
  );
  return res.status(200).json({ authorized: true });
}
