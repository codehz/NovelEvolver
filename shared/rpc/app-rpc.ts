import type { ProjectsService } from "./projects-rpc";
import type { WindowService } from "./window-rpc";

export interface AppRpcRoot {
  readonly window: WindowService;
  readonly projects: ProjectsService;
}
