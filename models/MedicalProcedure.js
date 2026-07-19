import mongoose from "mongoose";

const MedicalProcedureSchema = new mongoose.Schema(
  {
    medical_procedure_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true }, // แยกต่อสาขา
    name: { type: String, required: true },
    type: { type: String, enum: ["BT", "doctor"], required: true },
    cost: { type: Number, required: true }, // ค่ามือเรทคงที่ บาท/ครั้ง
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.MedicalProcedure ||
  mongoose.model("MedicalProcedure", MedicalProcedureSchema);
