// ── OSOTH realtime socket service (แยก process ตามสถาปัตย์ V2) ──
// - client ต่อด้วย JWT (handshake.auth.token) → เข้าห้อง user:<ID> + role:<role>
// - Next API ยิง event เข้ามาทาง POST /emit (secret ภายใน) → กระจายให้ห้องที่เกี่ยว
// - ถ้าตั้ง REDIS_URL: subscribe channel "osoth:events" ด้วย (รองรับหลาย instance / คนละเครื่อง)
// รัน: npm run socket (port 3002 หรือ SOCKET_PORT)
import { createServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const PORT = Number(process.env.SOCKET_PORT || 3002);
const SECRET = process.env.AUTH_SECRET || "osoth-dev-secret-change-in-prod";
const EMIT_KEY = process.env.SOCKET_EMIT_KEY || SECRET; // secret สำหรับ Next → /emit

const http = createServer(async (req, res) => {
  // endpoint ภายใน: Next API สั่ง broadcast
  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { key, event, payload, rooms } = JSON.parse(body || "{}");
        if (key !== EMIT_KEY) { res.writeHead(403); return res.end("forbidden"); }
        broadcast(event, payload, rooms);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400); res.end("bad request");
      }
    });
    return;
  }
  if (req.url === "/healthz") { res.writeHead(200); return res.end("ok"); }
  res.writeHead(404); res.end();
});

const io = new Server(http, {
  cors: { origin: true, credentials: true },
  // ใต้ subpath (VPS): ตั้ง SOCKET_PATH=/osoth/socket.io ให้ตรงกับ nginx location
  path: process.env.SOCKET_PATH || "/socket.io",
});

// auth: token จาก handshake → รู้ user_ID/role → join ห้อง
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || "";
    const payload = jwt.verify(token, SECRET);
    socket.data.user = payload; // { user_ID, role, branch_ID }
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const { user_ID, role } = socket.data.user;
  socket.join(`user:${user_ID}`);
  socket.join(`role:${role}`);
  socket.join("all");
});

function broadcast(event, payload, rooms) {
  if (!event) return;
  const targets = rooms?.length ? rooms : ["all"];
  for (const room of targets) io.to(room).emit(event, payload || {});
}

// Redis pub/sub (optional — ใช้เมื่อ scale หลาย instance): subscribe แล้ว broadcast ต่อ
if (process.env.REDIS_URL) {
  const { default: Redis } = await import("ioredis");
  const sub = new Redis(process.env.REDIS_URL);
  sub.subscribe("osoth:events");
  sub.on("message", (_ch, msg) => {
    try {
      const { event, payload, rooms } = JSON.parse(msg);
      broadcast(event, payload, rooms);
    } catch {}
  });
  console.log("[socket] redis subscribed:", process.env.REDIS_URL);
}

http.listen(PORT, () => console.log(`[socket] osoth realtime on :${PORT}`));
