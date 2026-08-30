import type { RpcTarget } from "capnweb";

import type { ProjectLibraryService } from "../services/project-library-rpc";
import type { SettingsService } from "../services/settings-rpc";
import type { WindowService } from "../services/window-rpc";
import type { WorkspaceService } from "../services/workspace-rpc";

export interface AppRpcRoot extends RpcTarget {
  readonly window: WindowService;
  readonly projectLibrary: ProjectLibraryService;
  readonly workspace: WorkspaceService;
  readonly settings: SettingsService;
}
