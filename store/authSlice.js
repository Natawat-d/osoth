import { createSlice } from "@reduxjs/toolkit";

// mock auth: เก็บ user ที่เลือก + สาขาปัจจุบัน ลง localStorage
const saved =
  typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("osoth_auth") || "null")
    : null;

const authSlice = createSlice({
  name: "auth",
  initialState: saved || { user: null, branch_ID: null },
  reducers: {
    login(state, action) {
      state.user = action.payload.user;
      state.branch_ID = action.payload.branch_ID || action.payload.user.branch_ID;
      persist(state);
    },
    logout(state) {
      state.user = null;
      state.branch_ID = null;
      persist(state);
    },
    setBranch(state, action) {
      state.branch_ID = action.payload;
      persist(state);
    },
  },
});

function persist(state) {
  if (typeof window !== "undefined")
    localStorage.setItem(
      "osoth_auth",
      JSON.stringify({ user: state.user, branch_ID: state.branch_ID })
    );
}

export const { login, logout, setBranch } = authSlice.actions;
export default authSlice.reducer;
