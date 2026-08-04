import Expense from "@/models/Expense";
import { makeCrud } from "@/lib/crud";
import { apiHandler, requireRole, assertAmount } from "@/lib/api";
import { genId, localDate } from "@/services/ids";
import { postFromExpense, ensureCoA } from "@/services/gl";

const crud = makeCrud(Expense, {
  idField: "expense_ID",
  idPrefix: "EX",
  idDigits: 5,
  perms: ["finance"],
  readPerms: ["finance"], // ข้อมูลค่าใช้จ่าย = owner เท่านั้น (อ่านก็ต้องมีสิทธิ์)
  listFilter: (sp) => {
    const f = {};
    if (sp.get("from") || sp.get("to")) {
      f.date = {};
      if (sp.get("from")) f.date.$gte = sp.get("from");
      if (sp.get("to")) f.date.$lte = sp.get("to");
    }
    return f;
  },
});
export const GET = crud.list;
// POST เอง (ไม่ใช้ crud.create) — บันทึกแล้วลงบัญชีคู่ทันที (Dr ค่าใช้จ่าย / Cr เงินสด)
export const POST = apiHandler(async (req) => {
  const auth = requireRole(req, ["finance"]);
  await ensureCoA();
  const body = await req.json();
  // ยอดต้อง > 0 เสมอ — เอกสารยอด 0/ติดลบเคยทำ GL rebuild/รายงานพังทั้งระบบ
  const amount = assertAmount(body.amount, "ยอดค่าใช้จ่าย");
  const doc = await Expense.create({
    ...body,
    amount,
    date: body.date || localDate(),
    expense_ID: body.expense_ID || (await genId("EX", 5)),
    branch_ID: auth.branch_ID, // ล็อกสาขาตามผู้ใช้
    recorded_by: auth.user_ID,
  });
  await postFromExpense(doc);
  return doc;
});
