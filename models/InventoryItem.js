import mongoose from "mongoose";

const UsageLogSchema = new mongoose.Schema(
  {
    opd_ID: String,
    cc_used: Number,
    used_at: Date,
    closed_by: String,
  },
  { _id: false }
);

// 1 doc = สินค้าจริง 1 unit (เช่น 1 ขวด)
const InventoryItemSchema = new mongoose.Schema(
  {
    item_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    product_ID: { type: String, required: true, index: true },
    lot_ID: { type: String, required: true, index: true },
    state: {
      type: String,
      enum: ["unused", "in_use", "empty", "discarded"],
      default: "unused",
      index: true,
    },
    opened_at: { type: Date, default: null },
    open_expiry_at: { type: Date, default: null }, // เตือนอย่างเดียว ไม่บังคับทิ้ง
    uses_remaining: { type: Number, required: true },
    cc_remaining: { type: Number, required: true },
    usage_log: { type: [UsageLogSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

InventoryItemSchema.index({ branch_ID: 1, product_ID: 1, state: 1 });

export default mongoose.models.InventoryItem ||
  mongoose.model("InventoryItem", InventoryItemSchema);
