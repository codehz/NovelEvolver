import type { RpcTarget } from "capnweb";

import type { ProjectsService } from "./projects-rpc";
import type { WindowService } from "./window-rpc";

export interface AppRpcRoot extends RpcTarget {
  readonly window: WindowService;
  readonly projects: ProjectsService;
}
