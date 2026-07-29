import mongoose from "mongoose";

// แจ้งเตือนในระบบ (เก็บประวัติ + realtime ผ่าน socket)
// target: user_ID เจาะจงคน หรือ role ทั้งกลุ่ม (อย่างใดอย่างหนึ่ง)
const NotificationSchema = new mongoose.Schema(
  {
    notif_ID: { type: String, required: true, unique: true },
    user_ID: { type: String, default: null, index: true },
    role: { type: String, default: null, index: true },
    type: { type: String, default: "info" }, // info | queue | stock | finance
    title: { type: String, required: true },
    message: { type: String, default: "" },
    ref: {
      opd_ID: { type: String, default: null },
      reserve_ID: { type: String, default: null },
      href: { type: String, default: null }, // ลิงก์หน้าเป้าหมาย
    },
    read_by: { type: [String], default: [] }, // user_ID ที่อ่านแล้ว (รองรับ role กลุ่ม)
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

NotificationSchema.index({ created_at: -1 });

export default mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
