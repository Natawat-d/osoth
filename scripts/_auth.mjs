// ตัวช่วย login สำหรับ test scripts — แลก username/password เป็น JWT (Bearer)
// ต้อง seed ก่อน (ทุกบัญชี seed รหัส "1234")
const BASE = process.env.BASE_URL || "http://localhost:3000/api";

// user_ID → username (ตรงกับ SEED_USERNAMES ใน seed.mjs)
export const USERNAMES = {
  "US-001": "owner", "US-002": "admin", "US-004": "sale",
  "US-005": "dr.mangkorn", "US-006": "dr.hong", "US-007": "bt1", "US-008": "bt2",
  "US-009": "admin2", "US-010": "sale2", "US-011": "dr.suea", "US-012": "bt3",
};

// login คนเดียว → token
export async function loginToken(username, password = "1234") {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`login ${username} ล้มเหลว: ${json.error || res.status}`);
  return json.data.token;
}

// login ทุกบัญชี seed → { [user_ID]: token }
export async function loginAllTokens() {
  const tokens = {};
  for (const [uid, uname] of Object.entries(USERNAMES)) {
    try { tokens[uid] = await loginToken(uname); } catch { /* บาง user อาจไม่มีใน seed ย่อย */ }
  }
  return tokens;
}
