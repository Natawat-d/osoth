import { nextSeq, pad } from "@/models/Counter";
import SystemConfig from "@/models/SystemConfig";

// รหัสรันทั่วไป เช่น genId("RS") → "RS-0001"
export async function genId(prefix, digits = 4) {
  const seq = await nextSeq(prefix);
  return `${prefix}-${pad(seq, digits)}`;
}

// HN ตาม format ใน system_config (config ได้: prefix/ปี พ.ศ./จำนวนหลัก/reset รายปี)
export async function genHN(branch_ID) {
  const config = (await SystemConfig.findOne({ branch_ID: null })) || {};
  const hn = config.hn_format || {
    prefix: "HN",
    include_year: true,
    digits: 4,
    reset_yearly: true,
  };
  const yearBE = new Date().getFullYear() + 543;
  const counterKey = hn.reset_yearly
    ? `HN:${branch_ID}:${yearBE}`
    : `HN:${branch_ID}`;
  const seq = await nextSeq(counterKey);
  const parts = [hn.prefix];
  if (hn.include_year) parts.push(String(yearBE));
  parts.push(pad(seq, hn.digits));
  return parts.join("-");
}
