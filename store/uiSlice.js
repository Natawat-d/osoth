import { createSlice } from "@reduxjs/toolkit";

const savedLang =
  typeof window !== "undefined"
    ? localStorage.getItem("osoth_lang") || "th"
    : "th";

const uiSlice = createSlice({
  name: "ui",
  initialState: { lang: savedLang },
  reducers: {
    setLang(state, action) {
      state.lang = action.payload;
      if (typeof window !== "undefined")
        localStorage.setItem("osoth_lang", action.payload);
    },
  },
});

export const { setLang } = uiSlice.actions;
export default uiSlice.reducer;
