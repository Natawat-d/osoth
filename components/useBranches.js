"use client";
// hook กลาง: โหลดรายชื่อสาขา + helper แปลง branch_ID → ชื่อสาขา / options สำหรับ select
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export function useBranches() {
  const [branches, setBranches] = useState([]);
  useEffect(() => { api("/branches").then(setBranches).catch(() => {}); }, []);
  const branchOptions = branches.map((b) => ({ value: b.branch_ID, label: b.name }));
  const branchName = (id) => branches.find((b) => b.branch_ID === id)?.name || id || "-";
  return { branches, branchOptions, branchName };
}
