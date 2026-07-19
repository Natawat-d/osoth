import mongoose from "mongoose";

// ใบสั่งซื้อ (GAP-05: stock reorder → PO)
const PurchaseOrderSchema = new mongoose.Schema(
  {
    po_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    supplier: { type: String, default: "" },
    items: {
      type: [
        {
          product_ID: String,
          name: String,
          qty: Number,
          cost_price_per_unit: Number,
          _id: false,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "ordered", "received", "cancelled"],
      default: "draft",
      index: true,
    },
    note: { type: String, default: "" },
    created_by: { type: String, default: "" },
    received_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.PurchaseOrder ||
  mongoose.model("PurchaseOrder", PurchaseOrderSchema);
