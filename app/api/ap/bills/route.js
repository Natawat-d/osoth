import ApBill from "@/models/ApBill";
import Supplier from "@/models/Supplier";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { genId, localDate } from "@/services/ids";
import { postJE, ensureCoA } from "@/services/gl";

// GET /api/ap/bills?status=unpaid — บิลเจ้าหนี้
export const GET = apiHandler(async (req) => {
  requireOwner(req);
  const sp = new URL(req.url).searchParams;
  const filter = {};
  if (sp.get("status") === "unpaid") filter.status = { $ne: "paid" };
  else if (sp.get("status")) filter.status = sp.get("status");
  return ApBill.find(filter).sort({ bill_date: -1 }).lean();
});

// POST — คีย์บิลเจ้าหนี้ { supplier_ID, description, amount, bill_date, due_date, expense_account }
// ลงบัญชีทันที: Dr expense_account (default 1200 คลัง) / Cr 2000 (AP)
export const POST = apiHandler(async (req) => {
  const auth = requireOwner(req);
  await ensureCoA();
  const body = await req.json();
  if (!(body.amount > 0)) throw Object.assign(new Error("ยอดบิลต้องมากกว่า 0"), { status: 400 });

  let supplier_name = body.supplier_name || "";
  if (body.supplier_ID) {
    const sup = await Supplier.findOne({ supplier_ID: body.supplier_ID }).lean();
    if (sup) supplier_name = sup.name;
  }
  const bill = await ApBill.create({
    bill_ID: await genId("AP", 5),
    supplier_ID: body.supplier_ID || null,
    supplier_name,
    po_ID: body.po_ID || null,
    description: body.description || "",
    amount: body.amount,
    bill_date: body.bill_date || localDate(),
    due_date: body.due_date || "",
    expense_account: body.expense_account || "1200",
    created_by: auth.user_ID,
  });
  await postJE({
    date: bill.bill_date,
    memo: `ตั้งหนี้ ${supplier_name || ""} · ${bill.description || bill.bill_ID}`,
    lines: [
      { account_code: bill.expense_account, debit: bill.amount, credit: 0 },
      { account_code: "2000", debit: 0, credit: bill.amount },
    ],
    source_type: "ap_bill",
    source_ID: bill.bill_ID,
    posted_by: auth.user_ID,
  });
  return bill;
});
