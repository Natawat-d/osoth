import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import ui from "./uiSlice";
import { apiSlice } from "./apiSlice";

// RTK Query (apiSlice) = data layer กลาง — cache/refetch อัตโนมัติผ่าน tags
export const makeStore = () =>
  configureStore({
    reducer: { auth, ui, [apiSlice.reducerPath]: apiSlice.reducer },
    middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
  });
