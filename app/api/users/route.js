import User from "@/models/User";
import { makeCrud } from "@/lib/crud";
import { apiHandler, getAuth } from "@/lib/api";
import { MAIN_BRANCH } from "@/lib/branch";

// กันไม่ให้ตั้ง credential/lockout ผ่าน CRUD ทั่วไป — ใช้ endpoint เฉพาะ (login/reset-password)
// V2 single-branch: ไม่ส่ง branch_ID มา → ลงสาขาหลักเสมอ
const stripAuth = (body, ctx) => {
  const b = { ...body };
  for (const k of ["password", "password_hash", "must_change_password", "failed_attempts", "locked_until"]) delete b[k];
  if (ctx?.mode === "create" && !b.branch_ID) b.branch_ID = MAIN_BRANCH;
  return b;
};

const crud = makeCrud(User, {
  idField: "user_ID",
  idPrefix: "US",
  beforeWrite: stripAuth,
  select: "-password_hash",
  listFilter: (sp) => {
    const f = {};
    if (sp.get("role")) f.role = sp.get("role");
    if (sp.get("active") !== "all") f.active = true;
    return f;
  },
});
// list เอง: เงินเดือน/คอมเป็นข้อมูลอ่อนไหว — เห็นเฉพาะ owner (หน้า HR) · role อื่นได้รายชื่อ/บทบาทพอ
export const GET = apiHandler(async (req) => {
  const auth = getAuth(req);
  const sp = new URL(req.url).searchParams;
  const f = {};
  if (sp.get("role")) f.role = sp.get("role");
  if (sp.get("active") !== "all") f.active = true;
  const hide = auth.role === "super_admin" ? "-password_hash" : "-password_hash -salary -commission_rate";
  return User.find(f).select(hide).sort({ created_at: -1 }).lean();
});
export const POST = crud.create;
