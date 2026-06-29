import type { ProjectsService } from "./projects-rpc";
import type { WindowService } from "./window-rpc";

export interface AppRpcRoot {
  getWindowService(): Promise<WindowService>;
  getProjectsService(): Promise<ProjectsService>;
}
