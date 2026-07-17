import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    payment_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    HN_number: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: ["course_purchase", "installment", "add_on"],
      required: true,
    },
    ref: {
      customer_course_ID: { type: String, default: null },
      opd_ID: { type: String, default: null },
    },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["cash", "transfer", "card"],
      required: true,
    },
    paid_at: { type: Date, required: true },
    received_by: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

PaymentSchema.index({ branch_ID: 1, paid_at: 1 });

export default mongoose.models.Payment ||
  mongoose.model("Payment", PaymentSchema);
