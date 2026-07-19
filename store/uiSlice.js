import { createSlice } from "@reduxjs/toolkit";

const savedLang =
  typeof window !== "undefined"
    ? localStorage.getItem("osoth_lang") || "th"
    : "th";

let _tid = 1;

const uiSlice = createSlice({
  name: "ui",
  initialState: { lang: savedLang, toasts: [] },
  reducers: {
    setLang(state, action) {
      state.lang = action.payload;
      if (typeof window !== "undefined")
        localStorage.setItem("osoth_lang", action.payload);
    },
    // toast: { type: "success"|"error"|"info", message }
    pushToast(state, action) {
      state.toasts.push({ id: _tid++, type: "info", ...action.payload });
    },
    dismissToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { setLang, pushToast, dismissToast } = uiSlice.actions;
export default uiSlice.reducer;
