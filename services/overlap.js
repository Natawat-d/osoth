import Reserve, { RESERVE_ACTIVE_STATUSES } from "@/models/Reserve";

// กันจองซ้อน — block เด็ดขาด:
// 1) ห้องเดียวกัน + ช่วงเวลา overlap
// 2) หมอคนเดียวกัน + ช่วงเวลา overlap (คนละห้องก็ห้าม)
// นับเฉพาะคิวที่ยังมีผล (booked/arrived/ready/in_progress)
export async function findOverlap({
  branch_ID,
  date,
  room_ID,
  doctor_ID,
  unix_start,
  unix_end,
  exclude_reserve_ID = null,
}) {
  const timeClash = {
    unix_start: { $lt: unix_end },
    unix_end: { $gt: unix_start },
  };
  const base = {
    branch_ID,
    date,
    status: { $in: RESERVE_ACTIVE_STATUSES },
    ...timeClash,
  };
  if (exclude_reserve_ID) base.reserve_ID = { $ne: exclude_reserve_ID };

  const clauses = [{ ...base, room_ID }];
  if (doctor_ID) clauses.push({ ...base, doctor_ID });

  const clash = await Reserve.findOne({ $or: clauses }).lean();
  if (!clash) return null;
  return {
    reserve_ID: clash.reserve_ID,
    reason:
      clash.room_ID === room_ID ? "room_overlap" : "doctor_overlap",
    with: clash,
  };
}

export function toUnix(date, time) {
  // date "YYYY-MM-DD", time "HH:mm" — ตีความเป็นเวลาท้องถิ่นเครื่อง server
  return new Date(`${date}T${time}:00`).getTime();
}
