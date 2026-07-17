import mongoose from "mongoose";

const PromotionSchema = new mongoose.Schema(
  {
    promotion_ID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["discount", "new_course"], required: true },
    // type=discount: ลดทับ course เดิม
    course_ID: { type: String, default: null },
    discount_type: { type: String, enum: ["percent", "amount", null], default: null },
    discount_value: { type: Number, default: 0 },
    // type=new_course: ชี้ไป course โปรที่สร้างใหม่
    promo_course_ID: { type: String, default: null },
    date_start: { type: String, required: true },
    date_end: { type: String, required: true },
    banner_image: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Promotion ||
  mongoose.model("Promotion", PromotionSchema);
