"use client";
// /store (เก่า) → /calendar — คงไว้ให้ลิงก์เดิมไม่ตาย
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StoreRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/calendar"); }, [router]);
  return null;
}
