import { createSlice } from "@reduxjs/toolkit";

// auth จริง: JWT — ส่งเป็น Bearer token (เก็บ localStorage) + httpOnly cookie (สำรอง)
// ใช้ Bearer เพื่อให้ทำงานได้ทุก deploy (AWS/ALB/HTTP ที่ Secure-cookie อาจไม่ถูกเก็บ)
const savedBranch = typeof window !== "undefined" ? localStorage.getItem("osoth_branch") : null;

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, branch_ID: savedBranch, ready: false, must_change_password: false },
  reducers: {
    login(state, action) {
      state.user = action.payload.user;
      // เก็บ token ไว้ส่งเป็น Bearer (มีเฉพาะตอน login จริง — /me ไม่ส่ง token กลับ)
      if (action.payload.token) persistToken(action.payload.token);
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
      persistToken(null);
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

function persistToken(t) {
  if (typeof window === "undefined") return;
  if (!t) localStorage.removeItem("osoth_token");
  else localStorage.setItem("osoth_token", t);
}

export const { login, logout, setBranch, clearMustChange, setReady } = authSlice.actions;
export default authSlice.reducer;
