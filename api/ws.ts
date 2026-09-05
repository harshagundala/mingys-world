import http from "node:http";
import { WebSocketServer } from "ws";
import { attachSocket } from "../server/hub.ts";
const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ service: "mingys-world", websocket: true }));
});
const wss = new WebSocketServer({
  server,
  maxPayload: 50000,
  perMessageDeflate: false,
});
wss.on("connection", attachSocket);
export default server;
