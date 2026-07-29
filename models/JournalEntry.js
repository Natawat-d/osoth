import mongoose from "mongoose";

// สมุดรายวัน (Journal Entry) — บัญชีคู่: รวม debit ต้องเท่า credit เสมอ (ตรวจใน services/gl)
// source: ที่มาของรายการ (ระบบ post อัตโนมัติจากธุรกรรม → idempotent ด้วย source_type+source_ID)
const JournalEntrySchema = new mongoose.Schema(
  {
    je_ID: { type: String, required: true, unique: true },
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    memo: { type: String, default: "" },
    lines: {
      type: [
        {
          account_code: { type: String, required: true },
          debit: { type: Number, default: 0 },
          credit: { type: Number, default: 0 },
          note: { type: String, default: "" },
          _id: false,
        },
      ],
      required: true,
    },
    // ที่มา: manual | payment | cogs | earning | expense | stock_receive | ap_bill | ap_payment | stock_adjust
    source_type: { type: String, default: "manual", index: true },
    source_ID: { type: String, default: null },
    posted_by: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// กัน post ซ้ำจากธุรกรรมเดียวกัน (rebuild ได้ปลอดภัย)
JournalEntrySchema.index(
  { source_type: 1, source_ID: 1 },
  { unique: true, partialFilterExpression: { source_ID: { $type: "string" } } }
);

export default mongoose.models.JournalEntry || mongoose.model("JournalEntry", JournalEntrySchema);
