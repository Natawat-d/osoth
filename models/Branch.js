import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema(
  {
    branch_ID: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Branch || mongoose.model("Branch", BranchSchema);
