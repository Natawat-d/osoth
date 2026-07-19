import { createSlice } from "@reduxjs/toolkit";

// auth จริง: user มาจาก JWT cookie (เช็คผ่าน /api/auth/me) — เก็บใน redux เท่านั้น
// เก็บ localStorage แค่ "สาขาที่เลือก" (owner สลับสาขา) ไม่เก็บ user
const savedBranch = typeof window !== "undefined" ? localStorage.getItem("osoth_branch") : null;

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, branch_ID: savedBranch, ready: false, must_change_password: false },
  reducers: {
    login(state, action) {
      state.user = action.payload.user;
      // owner (super_admin) คงสาขาที่เคยเลือกไว้; role อื่นล็อกที่สาขาตัวเอง
      const saved = typeof window !== "undefined" ? localStorage.getItem("osoth_branch") : null;
      state.branch_ID =
        action.payload.user.role === "super_admin" && saved !== null
          ? saved
          : action.payload.user.branch_ID;
      state.must_change_password = !!action.payload.must_change_password;
      state.ready = true;
      persistBranch(state.branch_ID);
    },
    logout(state) {
      state.user = null;
      state.must_change_password = false;
      state.ready = true;
    },
    setBranch(state, action) { state.branch_ID = action.payload; persistBranch(action.payload); },
    clearMustChange(state) { state.must_change_password = false; },
    setReady(state) { state.ready = true; },
  },
});

function persistBranch(b) {
  if (typeof window === "undefined") return;
  if (b == null) localStorage.removeItem("osoth_branch");
  else localStorage.setItem("osoth_branch", b);
}

export const { login, logout, setBranch, clearMustChange, setReady } = authSlice.actions;
export default authSlice.reducer;
