// fetch wrapper ฝั่ง client — auth ผ่าน httpOnly cookie (แนบอัตโนมัติ)
// ส่ง x-branch-id = สาขาที่เลือก (owner สลับสาขา; คนอื่นถูกล็อกที่สาขาตัวเองที่ฝั่ง server)
export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const branch = localStorage.getItem("osoth_branch");
    if (branch !== null) headers["x-branch-id"] = branch; // "" = ทุกสาขา (owner)
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "include",
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
