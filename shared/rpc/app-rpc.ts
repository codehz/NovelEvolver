import type { RpcTarget } from "capnweb";

import type { ProjectLibraryService } from "./project-library-rpc";
import type { SettingsService } from "./settings-rpc";
import type { WindowService } from "./window-rpc";
import type { WorkspaceService } from "./workspace-rpc";

export interface AppRpcRoot extends RpcTarget {
  readonly window: WindowService;
  readonly projectLibrary: ProjectLibraryService;
  readonly workspace: WorkspaceService;
  readonly settings: SettingsService;
}
