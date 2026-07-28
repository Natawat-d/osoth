// fetch wrapper ฝั่ง client — auth ผ่าน httpOnly cookie (แนบอัตโนมัติ)
// ส่ง x-branch-id = สาขาที่เลือก (owner สลับสาขา; คนอื่นถูกล็อกที่สาขาตัวเองที่ฝั่ง server)
export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    // ส่ง JWT เป็น Bearer — ให้ทำงานได้ทุก deploy แม้ httpOnly cookie จะไม่ถูกเก็บ (เช่น AWS/ALB/HTTP)
    const token = localStorage.getItem("osoth_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const branch = localStorage.getItem("osoth_branch");
    if (branch !== null) headers["x-branch-id"] = branch; // "" = ทุกสาขา (owner)
  }
  // รองรับ deploy แบบ subpath (เช่น /osoth) — prefix ด้วย basePath ที่ build ไว้ (ว่าง = root)
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api${path}`, {
    method,
    headers,
    credentials: "include", // แนบ cookie เป็นช่องทางสำรอง
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ ok: false, error: "bad json" }));
  if (!json.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json.data;
}
