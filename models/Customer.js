import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    HN_number: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true }, // สาขาที่ลงทะเบียนครั้งแรก
    full_name: { type: String, required: true },
    sure_name: { type: String, default: "" },
    nick_name: { type: String, default: "" },
    phone: { type: String, default: "", index: true },
    email: { type: String, default: "" },
    birth_date: { type: String, default: "" },
    gender: { type: String, default: "" },
    drug_allergies: { type: [String], default: [] },
    chronic_diseases: { type: [String], default: [] },
    note: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Customer ||
  mongoose.model("Customer", CustomerSchema);
