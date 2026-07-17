import mongoose from "mongoose";

export const ROLES = [
  "super_admin",
  "admin",
  "acception",
  "sale",
  "BT",
  "doctor",
];

const UserSchema = new mongoose.Schema(
  {
    user_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    role: { type: String, enum: ROLES, required: true },
    full_name: { type: String, required: true },
    nick_name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    commission_rate: { type: Number, default: 0 }, // % — ใช้กับ role sale
    color: { type: String, default: "#B3282D" }, // สีบนปฏิทิน (หมอ)
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
