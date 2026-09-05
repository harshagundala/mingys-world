import http from "node:http";
import { WebSocketServer } from "ws";
import { attachSocket } from "../server/hub.ts";
import session from "../api/session.ts";
import photo from "../api/photo.ts";
const server = http.createServer(async (req: any, res: any) => {
  res.status = (n: number) => {
    res.statusCode = n;
    return res;
  };
  res.json = (o: any) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(o));
  };
  res.send = (d: any) => res.end(d);
  try {
    if (req.method === "POST") {
      let b = "";
      for await (const c of req) b += c;
      req.body = b;
    }
    if (req.url.startsWith("/api/session")) await session(req, res);
    else if (req.url.startsWith("/api/photo")) await photo(req, res);
    else res.status(404).end();
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});
new WebSocketServer({ server, maxPayload: 50000 }).on(
  "connection",
  attachSocket,
);
server.listen(Number(process.env.MINGY_LOCAL_PORT || 3001), "127.0.0.1", () =>
  console.log("Mingy multiplayer ready on :3001"),
);
