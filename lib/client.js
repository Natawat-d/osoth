// fetch wrapper ฝั่ง client — แนบ mock auth headers จาก localStorage ทุก request
export async function api(path, { method = "GET", body } = {}) {
  const auth = JSON.parse(localStorage.getItem("osoth_auth") || "null");
  const headers = { "Content-Type": "application/json" };
  if (auth?.user) {
    headers["x-user-id"] = auth.user.user_ID;
    headers["x-user-role"] = auth.user.role;
    headers["x-branch-id"] = auth.branch_ID || auth.user.branch_ID;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
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
