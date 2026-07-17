"use client";
// โปรโมชั่น 2 แบบ: ส่วนลดทับ course เดิม / ชี้ไป course โปรใหม่ (สร้างในหน้า courses)
import { useEffect, useState } from "react";
import CrudPage from "@/components/CrudPage";
import { api } from "@/lib/client";

export default function PromotionsPage() {
  const [courses, setCourses] = useState([]);
  useEffect(() => {
    api("/courses").then((c) => setCourses(c.filter((x) => x.active)));
  }, []);
  const courseOptions = courses.map((c) => ({ value: c.course_ID, label: c.name }));

  return (
    <CrudPage
      title="โปรโมชั่น"
      endpoint="/promotions"
      idField="promotion_ID"
      transform={(s) => ({ ...s, discount_value: +s.discount_value || 0 })}
      fields={[
        { key: "name", label: "ชื่อโปร" },
        {
          key: "type", label: "ชนิด", type: "select",
          options: [
            { value: "discount", label: "ส่วนลดทับ course เดิม" },
            { value: "new_course", label: "course โปรแยกตัวใหม่" },
          ],
        },
        { key: "course_ID", label: "course เดิม (แบบส่วนลด)", type: "select", options: () => courseOptions },
        {
          key: "discount_type", label: "ลดแบบ", type: "select",
          options: [
            { value: "percent", label: "%" },
            { value: "amount", label: "บาท" },
          ],
        },
        { key: "discount_value", label: "มูลค่าส่วนลด", type: "number" },
        { key: "promo_course_ID", label: "course โปร (แบบตัวใหม่)", type: "select", options: () => courseOptions, show: false },
        { key: "date_start", label: "เริ่ม", type: "date" },
        { key: "date_end", label: "สิ้นสุด", type: "date" },
        {
          key: "banner_image", label: "รูปแบนเนอร์ (โชว์ carousel หน้าร้าน)",
          type: "image", show: false,
        },
      ]}
    />
  );
}
