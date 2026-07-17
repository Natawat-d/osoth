import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    expense_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ["rent", "salary", "utility", "other"],
      default: "other",
    },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    date: { type: String, required: true, index: true },
    recorded_by: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Expense ||
  mongoose.model("Expense", ExpenseSchema);
