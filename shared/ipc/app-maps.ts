import type { WindowState } from "../window";

export type AppIpcMethodMap = {
  "window:get-state": () => Promise<WindowState>;
  "window:minimize": () => Promise<void>;
  "window:toggle-maximize": () => Promise<WindowState>;
  "window:close": () => Promise<void>;
};

export type AppIpcEventMap = {
  "window:state-changed": WindowState;
};
