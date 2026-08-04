import mongoose from "mongoose";

// เคลียร์เงินบัตร/โอนที่ธนาคารจ่ายเข้าบัญชีจริง (T+1..3 หัก MDR)
// JE: Dr 1010 (สุทธิ) + Dr 6400 (ค่าธรรมเนียม) / Cr 1020 (ลูกหนี้บัตรรอเคลียร์)
const CardSettlementSchema = new mongoose.Schema(
  {
    settle_ID: { type: String, required: true, unique: true },
    date: { type: String, required: true },   // วันที่เงินเข้าบัญชี
    amount: { type: Number, required: true }, // ยอดเต็มที่เคลียร์ออกจาก 1020
    fee: { type: Number, default: 0 },        // ค่าธรรมเนียมบัตร (MDR)
    net: { type: Number, required: true },    // amount - fee = เงินเข้าธนาคารจริง
    note: { type: String, default: "" },
    recorded_by: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.CardSettlement || mongoose.model("CardSettlement", CardSettlementSchema);
