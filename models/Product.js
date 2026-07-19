import mongoose from "mongoose";

// catalog สินค้า — ทุนจริงอยู่ที่ StockLot เพราะแต่ละ lot ราคาไม่เท่ากัน
const ProductSchema = new mongoose.Schema(
  {
    product_ID: { type: String, required: true, unique: true },
    branch_ID: { type: String, required: true, index: true }, // catalog แยกต่อสาขา
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["injection", "consumable", "other"],
      default: "other",
    },
    unit: { type: String, default: "ชิ้น" }, // หน่วยใหญ่ เช่น ขวด
    sub_unit: { type: String, default: "" }, // หน่วยย่อย เช่น cc
    sub_unit_size: { type: Number, default: 1 }, // 1 unit = กี่ sub_unit (1 = แบ่งไม่ได้)
    default_uses_per_unit: { type: Number, default: 1 }, // 1 unit ใช้ได้กี่ครั้ง
    selling_price: { type: Number, default: 0 }, // ราคาขายตอนเป็น add_on
    // add-on ตัด stock: กี่ sub_unit ต่อ 1 หน่วย add-on (× qty ตอนปิดเคส)
    addon_sub_unit_per_use: { type: Number, default: 0 }, // 0 = ตัดเต็ม 1 unit ต่อ qty
    reorder_point: { type: Number, default: 0 },
    shelf_life_after_open_days: { type: Number, default: 0 }, // 0 = ไม่เตือน
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
