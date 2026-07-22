"use client";
import CrudPage from "@/components/CrudPage";
import { money } from "@/components/ui";
import { useBranches } from "@/components/useBranches";

export default function ProductsPage() {
  const { branchOptions, branchName } = useBranches();
  return (
    <CrudPage
      title="สินค้า (catalog · แยกสาขา — ทุนจริงอยู่ที่ lot ตอนรับของเข้า)"
      endpoint="/products"
      idField="product_ID"
      transform={(s) => ({
        ...s,
        sub_unit_size: +s.sub_unit_size || 1,
        default_uses_per_unit: +s.default_uses_per_unit || 1,
        selling_price: +s.selling_price || 0,
        reorder_point: +s.reorder_point || 0,
        shelf_life_after_open_days: +s.shelf_life_after_open_days || 0,
      })}
      fields={[
        { key: "branch_ID", label: "สาขา", type: "select", options: () => branchOptions, render: (v) => branchName(v) },
        { key: "name", label: "ชื่อ" },
        {
          key: "type", label: "ประเภท", type: "select",
          options: [
            { value: "injection", label: "ยาฉีด" },
            { value: "consumable", label: "ของใช้สิ้นเปลือง" },
            { value: "other", label: "อื่นๆ" },
          ],
        },
        { key: "unit", label: "หน่วยใหญ่ (ขวด/กล่อง)" },
        { key: "sub_unit", label: "หน่วยย่อย (cc)" },
        { key: "sub_unit_size", label: "ขนาด/หน่วย (1 ขวด = กี่ cc)", type: "number" },
        { key: "default_uses_per_unit", label: "ใช้ได้กี่ครั้ง/หน่วย", type: "number" },
        { key: "selling_price", label: "ราคาขาย (add-on)", type: "number", render: (v) => `${money(v)}฿` },
        { key: "reorder_point", label: "จุดสั่งซื้อ", type: "number", show: false },
        { key: "shelf_life_after_open_days", label: "วันหมดอายุหลังเปิด (0=ไม่เตือน)", type: "number", show: false },
      ]}
    />
  );
}
