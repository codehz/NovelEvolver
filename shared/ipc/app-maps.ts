import type { ProjectListItem, ProjectRecord } from "@shared/project";
import type { WindowState } from "@shared/window";

export type AppIpcMethodMap = {
  "window:get-state": () => Promise<WindowState>;
  "window:minimize": () => Promise<void>;
  "window:toggle-maximize": () => Promise<WindowState>;
  "window:close": () => Promise<void>;
  "window:set-title": (title: string) => Promise<void>;
  "projects:list": () => Promise<ProjectListItem[]>;
  "projects:get": (id: number) => Promise<ProjectListItem | null>;
  "projects:open-dialog": () => Promise<ProjectRecord | null>;
  "projects:create-dialog": () => Promise<ProjectRecord | null>;
  "projects:record-open": (id: number) => Promise<ProjectRecord | null>;
  "projects:remove": (id: number) => Promise<boolean>;
};

export type AppIpcEventMap = {
  "window:state-changed": WindowState;
};

export type WindowIpcMethodMap = Pick<
  AppIpcMethodMap,
  Extract<keyof AppIpcMethodMap, `window:${string}`>
>;

export type ProjectsIpcMethodMap = Pick<
  AppIpcMethodMap,
  Extract<keyof AppIpcMethodMap, `projects:${string}`>
>;

/** Must be `never` — add a new `*-handlers.ts` (or extend prefix lists) when introducing other channel namespaces. */
export type UncategorizedAppIpcMethodChannels = Exclude<
  keyof AppIpcMethodMap,
  keyof WindowIpcMethodMap | keyof ProjectsIpcMethodMap
>;
