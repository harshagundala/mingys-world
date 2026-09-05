import fs from "node:fs/promises";
import path from "node:path";
export default async function handler(req: any, res: any) {
  const q = new URL(req.url, "http://localhost").searchParams,
    id = q.get("id") || "";
  if (!/^([0-9]|[12][0-9])$/.test(id)) return res.status(404).end();
  try {
    const data = await fs.readFile(
      path.join(
        process.cwd(),
        "private-assets/photos",
        `${id}${q.get("thumb") === "1" ? "-thumb" : ""}.webp`,
      ),
    );
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Vary", "Cookie");
    res.status(200).send(data);
  } catch {
    res.status(404).end();
  }
}
