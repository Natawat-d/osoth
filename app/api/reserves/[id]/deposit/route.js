import Reserve from "@/models/Reserve";
import Payment from "@/models/Payment";
import { apiHandler, requireRole, assertAmount } from "@/lib/api";
import { genId } from "@/services/ids";
import { issueReceipt } from "@/services/receipts";
import { ensureCoA, postFromPayment, postDepositRefund } from "@/services/gl";

// POST /api/reserves/[id]/deposit { amount, method } — รับมัดจำตอนจอง
// บัญชี: Dr เงินสด/โอน/บัตร / Cr เงินมัดจำรับล่วงหน้า (2300 — เป็นหนี้สิน ไม่ใช่รายได้)
export const POST = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["queue", "booking"]);
  const { id } = await params;
  const body = await req.json();
  const amount = assertAmount(body.amount, "ยอดมัดจำ");
  const method = ["cash", "transfer", "card"].includes(body.method) ? body.method : "cash";

  // claim กันวางซ้ำ: วางได้เมื่อยังไม่มีมัดจำค้าง
  const rs = await Reserve.findOneAndUpdate(
    { reserve_ID: id, deposit_status: { $in: ["none", "refunded", "forfeited"] }, status: { $nin: ["cancelled", "done"] } },
    { $set: { deposit: amount, deposit_status: "held" } },
    { new: true }
  );
  if (!rs) throw Object.assign(new Error("คิวนี้มีมัดจำค้างอยู่แล้ว หรือคิวจบไปแล้ว"), { status: 409 });

  const pay = await Payment.create({
    payment_ID: await genId("PAY", 6),
    branch_ID: rs.branch_ID,
    HN_number: rs.HN_number || null,
    type: "deposit",
    ref: { customer_course_ID: null, opd_ID: null, reserve_ID: id },
    amount, method,
    paid_at: new Date(),
    received_by: auth.user_ID,
  });
  await Reserve.updateOne({ reserve_ID: id }, { $set: { deposit_payment_ID: pay.payment_ID } });
  await ensureCoA();
  await postFromPayment(pay);
  const receipt = await issueReceipt({
    branch_ID: rs.branch_ID, HN_number: rs.HN_number || null,
    customer_name: rs.contact?.nick_name || "",
    items: [{ description: `มัดจำการจองคิว ${rs.date} ${rs.time_start}`, amount }],
    payments: [{ payment_ID: pay.payment_ID, method, amount }],
    ref: { reserve_ID: id },
    issued_by: auth.user_ID,
  });
  return { payment: pay, receipt, deposit_status: "held" };
});

// DELETE /api/reserves/[id]/deposit { method } — คืนมัดจำ (ยกเลิกล่วงหน้า)
export const DELETE = apiHandler(async (req, { params }) => {
  const auth = requireRole(req, ["queue", "booking"]);
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const method = ["cash", "transfer"].includes(sp.get("method")) ? sp.get("method") : "cash";
  const rs = await Reserve.findOneAndUpdate(
    { reserve_ID: id, deposit_status: "held" },
    { $set: { deposit_status: "refunded", deposit_refund_method: method } },
    { new: true }
  );
  if (!rs) throw Object.assign(new Error("คิวนี้ไม่มีมัดจำค้างอยู่"), { status: 409 });
  await ensureCoA();
  await postDepositRefund(rs, method);
  return { reserve_ID: id, refunded: rs.deposit, method, by: auth.user_ID };
});
