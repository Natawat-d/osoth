import Expense from "@/models/Expense";
import { makeCrud } from "@/lib/crud";
import { apiHandler, requireRole } from "@/lib/api";
import { genId } from "@/services/ids";
import { postFromExpense, ensureCoA } from "@/services/gl";

const crud = makeCrud(Expense, {
  idField: "expense_ID",
  idPrefix: "EX",
  idDigits: 5,
  perms: ["finance"],
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
  const doc = await Expense.create({
    ...body,
    expense_ID: body.expense_ID || (await genId("EX", 5)),
    branch_ID: body.branch_ID || auth.branch_ID,
    recorded_by: auth.user_ID,
  });
  await postFromExpense(doc);
  return doc;
});
