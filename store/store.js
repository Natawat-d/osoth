import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import ui from "./uiSlice";

export const makeStore = () =>
  configureStore({ reducer: { auth, ui } });
