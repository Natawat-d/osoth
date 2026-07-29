import Notification from "@/models/Notification";
import { apiHandler, getAuth } from "@/lib/api";

// GET /api/notifications — แจ้งเตือนของฉัน (เจาะจง user หรือ role ของฉัน) ล่าสุด 30 รายการ
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.user_ID) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  const list = await Notification.find({
    $or: [{ user_ID: auth.user_ID }, { role: auth.role }],
  })
    .sort({ created_at: -1 })
    .limit(30)
    .lean();
  return list.map((n) => ({ ...n, read: n.read_by?.includes(auth.user_ID) }));
});

// PUT /api/notifications — mark อ่านแล้วทั้งหมดของฉัน
export const PUT = apiHandler(async (req) => {
  const auth = getAuth(req);
  if (!auth.user_ID) throw Object.assign(new Error("ยังไม่ได้เข้าสู่ระบบ"), { status: 401 });
  await Notification.updateMany(
    { $or: [{ user_ID: auth.user_ID }, { role: auth.role }], read_by: { $ne: auth.user_ID } },
    { $push: { read_by: auth.user_ID } }
  );
  return { ok: true };
});
