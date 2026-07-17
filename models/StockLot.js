import mongoose from "mongoose";

const StockLotSchema = new mongoose.Schema(
  {
    lot_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true },
    product_ID: { type: String, required: true, index: true },
    lot_number: { type: String, default: "" },
    supplier: { type: String, default: "" },
    cost_price_per_unit: { type: Number, required: true }, // ทุนจริงต่อ unit ของ lot นี้
    quantity_received: { type: Number, required: true },
    expiry_date: { type: String, default: "" }, // "YYYY-MM-DD"
    received_at: { type: String, required: true },
    received_by: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.StockLot ||
  mongoose.model("StockLot", StockLotSchema);
