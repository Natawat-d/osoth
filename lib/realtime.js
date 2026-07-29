// ── publisher ฝั่ง Next API → socket service ──
// ยิงแบบ fire-and-forget: ธุรกรรมหลักต้องไม่พังเพราะ realtime ล่ม
// ถ้าตั้ง REDIS_URL → publish ผ่าน Redis (socket service subscribe อยู่)
// ไม่งั้น → POST ตรงไป socket service /emit (dev/เครื่องเดียว)
import Notification from "@/models/Notification";
import { genId } from "@/services/ids";

const SOCKET_INTERNAL = process.env.SOCKET_INTERNAL_URL || "http://127.0.0.1:3002";
const EMIT_KEY = process.env.SOCKET_EMIT_KEY || process.env.AUTH_SECRET || "osoth-dev-secret-change-in-prod";

let redis = null;
async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 });
    redis.on("error", () => {}); // อย่าให้ redis ล่มพ่น unhandled
  }
  return redis;
}

// กระจาย event → ห้อง (rooms: ["user:US-001","role:doctor"] · ว่าง = ทุกคน)
export async function emitEvent(event, payload = {}, rooms = []) {
  try {
    const r = await getRedis();
    if (r) {
      await r.publish("osoth:events", JSON.stringify({ event, payload, rooms }));
      return;
    }
    await fetch(`${SOCKET_INTERNAL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: EMIT_KEY, event, payload, rooms }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // socket service ไม่ขึ้น = ข้าม (ไม่กระทบธุรกรรม)
  }
}

// แจ้งเตือนแบบเก็บประวัติ: บันทึกลง collection notification + push realtime
// target: { user_ID } เจาะจงคน หรือ { role } ทั้ง role
export async function notify({ user_ID = null, role = null, type = "info", title, message = "", ref = {} }) {
  try {
    const doc = await Notification.create({
      notif_ID: await genId("NT", 6),
      user_ID, role, type, title, message, ref,
    });
    const rooms = user_ID ? [`user:${user_ID}`] : role ? [`role:${role}`] : ["all"];
    await emitEvent("notify:new", {
      notif_ID: doc.notif_ID, type, title, message, ref, user_ID, role,
    }, rooms);
    return doc;
  } catch (e) {
    console.error("notify failed:", e.message);
    return null;
  }
}
