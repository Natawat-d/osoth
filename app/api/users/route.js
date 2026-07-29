import User from "@/models/User";
import { makeCrud } from "@/lib/crud";
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
export const GET = crud.list;
export const POST = crud.create;
