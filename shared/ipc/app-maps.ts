import type { ProjectRecord } from "../project";
import type { WindowState } from "../window";

export type AppIpcMethodMap = {
  "window:get-state": () => Promise<WindowState>;
  "window:minimize": () => Promise<void>;
  "window:toggle-maximize": () => Promise<WindowState>;
  "window:close": () => Promise<void>;
  "projects:list": () => Promise<ProjectRecord[]>;
  "projects:open-dialog": () => Promise<ProjectRecord | null>;
  "projects:record-open": (id: number) => Promise<ProjectRecord | null>;
};

export type AppIpcEventMap = {
  "window:state-changed": WindowState;
};
