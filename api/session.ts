import { publicRoom, resetPublicRoom } from "../server/store.ts";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid request" });
    }
  }
  try {
    // Visiting the homepage never resets progress. Reset is a deliberate action
    // on /reset, and moves the public entrance while retaining the old save.
    if (req.method === "POST" && body?.action === "reset")
      return res
        .status(200)
        .json({ authorized: true, ...(await resetPublicRoom()) });
    return res.status(200).json({ authorized: true, room: await publicRoom() });
  } catch {
    return res.status(503).json({
      error: "The house is reconnecting. Please try again in a moment.",
    });
  }
}
