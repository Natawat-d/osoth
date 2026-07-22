"use client";
import CrudPage from "@/components/CrudPage";
import { money } from "@/components/ui";
import { useBranches } from "@/components/useBranches";

export default function ProceduresPage() {
  const { branchOptions, branchName } = useBranches();
  return (
    <CrudPage
      title="หัตถการ + ค่ามือ (เรทคงที่ บาท/ครั้ง · แยกสาขา)"
      endpoint="/procedures"
      idField="medical_procedure_ID"
      transform={(s) => ({ ...s, cost: +s.cost || 0 })}
      fields={[
        { key: "branch_ID", label: "สาขา", type: "select", options: () => branchOptions, render: (v) => branchName(v) },
        { key: "name", label: "ชื่อหัตถการ" },
        {
          key: "type", label: "ประเภทผู้ทำ", type: "select",
          options: [
            { value: "BT", label: "BT (beauty therapist)" },
            { value: "doctor", label: "หมอ" },
          ],
        },
        { key: "cost", label: "ค่ามือ/ครั้ง", type: "number", render: (v) => `${money(v)}฿` },
      ]}
    />
  );
}
