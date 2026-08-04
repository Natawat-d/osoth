import mongoose from "mongoose";

// ปิดยอดสิ้นวัน — นับเงินสดจริงเทียบกับที่ระบบคำนวณ · ส่วนต่างลง JE อัตโนมัติ
// (ขาด → Dr สูญเสีย 6300 / Cr 1000 · เกิน → Dr 1000 / Cr รายได้อื่น 4100)
const DailyCloseSchema = new mongoose.Schema(
  {
    close_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    expected_cash: { type: Number, required: true }, // เงินสดที่ควรมีตามระบบ
    counted_cash: { type: Number, required: true },  // เงินสดที่นับได้จริง
    diff: { type: Number, required: true },          // counted - expected
    note: { type: String, default: "" },
    closed_by: { type: String, default: "" },
    closed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

DailyCloseSchema.index({ branch_ID: 1, date: 1 }, { unique: true }); // วันละครั้งต่อสาขา

export default mongoose.models.DailyClose || mongoose.model("DailyClose", DailyCloseSchema);
