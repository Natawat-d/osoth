import mongoose from "mongoose";

// งวดเงินเดือนรายเดือน (มาตรฐาน): ฐานเงินเดือน + ค่ามือ/คอมของเดือน + เพิ่มเติม(OT/โบนัส)
// − ประกันสังคม 5% (เพดานฐาน 15,000 → หักสูงสุด 750) − ภาษีหัก ณ ที่จ่าย − หักอื่น = สุทธิ
const PayrollRowSchema = new mongoose.Schema(
  {
    user_ID: { type: String, required: true },
    full_name: { type: String, default: "" },
    role: { type: String, default: "" },
    salary: { type: Number, default: 0 },       // ฐานเงินเดือน
    earnings: { type: Number, default: 0 },     // ค่ามือ/DF/คอมของเดือน (จาก staff_earnings)
    additions: { type: Number, default: 0 },    // OT/โบนัส/เบี้ยขยัน (กรอกเอง)
    sso: { type: Number, default: 0 },          // ประกันสังคมลูกจ้าง 5% (cap 750)
    tax: { type: Number, default: 0 },          // ภาษีหัก ณ ที่จ่าย (กรอกเอง)
    deduction: { type: Number, default: 0 },    // หักอื่น (ขาด/สาย/เบิกล่วงหน้า)
    net: { type: Number, default: 0 },
    note: { type: String, default: "" },
    prorated_days: { type: Number, default: null }, // เดือนแรก: จำนวนวันเช็คอินจริงที่ใช้คิด (null = เต็มเดือน)
    slip: { type: String, default: "" },            // สลิปโอนเงินเดือนรายคน (data URL ≤3MB)
    slip_at: { type: Date, default: null },
    _id: false,
  }
);

const PayrollRunSchema = new mongoose.Schema(
  {
    payroll_ID: { type: String, required: true, unique: true },
    period: { type: String, required: true, unique: true }, // "YYYY-MM" (เดือนละ 1 งวด)
    rows: { type: [PayrollRowSchema], default: [] },
    sso_employer: { type: Number, default: 0 }, // สมทบนายจ้าง 5% (เท่าลูกจ้าง)
    total_net: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "paid"], default: "draft", index: true },
    method: { type: String, enum: ["cash", "transfer"], default: "transfer" },
    paid_at: { type: Date, default: null },
    paid_by: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.PayrollRun || mongoose.model("PayrollRun", PayrollRunSchema);
