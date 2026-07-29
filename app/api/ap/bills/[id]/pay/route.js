import ApBill from "@/models/ApBill";
import { apiHandler } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { localDate } from "@/services/ids";
import { postFromApPayment, ensureCoA } from "@/services/gl";

// POST /api/ap/bills/[id]/pay { amount, method } — จ่ายเจ้าหนี้ (จ่ายบางส่วนได้)
// ลงบัญชี: Dr 2000 (AP) / Cr เงินสด-ธนาคารตาม method
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireOwner(req);
  await ensureCoA();
  const { id } = await params;
  const body = await req.json();
  const bill = await ApBill.findOne({ bill_ID: id });
  if (!bill) throw Object.assign(new Error("ไม่พบบิล"), { status: 404 });
  if (bill.status === "paid") throw Object.assign(new Error("บิลนี้จ่ายครบแล้ว"), { status: 409 });

  const paidSoFar = bill.payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = bill.amount - paidSoFar;
  const amount = Number(body.amount) || outstanding; // ไม่ระบุ = จ่ายที่เหลือทั้งหมด
  if (!(amount > 0) || amount > outstanding + 0.001)
    throw Object.assign(new Error(`ยอดจ่ายต้องอยู่ระหว่าง 0 ถึง ${outstanding}`), { status: 400 });

  const pay = { amount, method: body.method || "transfer", paid_at: body.paid_at || localDate(), paid_by: auth.user_ID };
  bill.payments.push(pay);
  const totalPaid = paidSoFar + amount;
  bill.status = totalPaid >= bill.amount - 0.001 ? "paid" : "partial";
  await bill.save();
  await postFromApPayment(bill, pay, bill.payments.length - 1);
  return bill;
});
