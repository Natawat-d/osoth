// Adapter แจ้งเตือน (GAP-02) — ตอนนี้เป็น stub (log)
// ต่อ LINE Messaging API จริงได้โดยเติมโค้ดในฟังก์ชัน send() + ตั้ง env:
//   LINE_CHANNEL_ACCESS_TOKEN, LINE_TARGET_ID
// interface คงเดิม เรียกที่จุดสร้าง reserve แล้ว

async function send(text, to) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const target = to || process.env.LINE_TARGET_ID;
  if (!token || !target) {
    // ยังไม่ตั้งค่า LINE → log ไว้เฉยๆ (stub)
    console.log("[notify:stub]", text);
    return { ok: false, stub: true };
  }
  // ต่อจริง (เปิดใช้เมื่อมี credentials):
  // await fetch("https://api.line.me/v2/bot/message/push", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  //   body: JSON.stringify({ to: target, messages: [{ type: "text", text }] }),
  // });
  return { ok: true };
}

export async function notifyBooking(reserve) {
  const who = reserve.contact?.nick_name || reserve.HN_number || "ลูกค้า";
  const msg = `📅 จองคิวใหม่: ${who} · ${reserve.date} ${reserve.time_start}–${reserve.time_end} · ห้อง ${reserve.room_ID}`;
  return send(msg);
}
