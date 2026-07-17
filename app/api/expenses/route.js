import Expense from "@/models/Expense";
import { makeCrud } from "@/lib/crud";

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
export const POST = crud.create;
