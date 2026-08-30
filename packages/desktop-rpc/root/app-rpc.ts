import type { RpcTarget } from "capnweb";

import type { ProjectLibraryService } from "#desktop-rpc/services/project-library-service";
import type { SettingsService } from "#desktop-rpc/services/settings-service";
import type { WindowService } from "#desktop-rpc/services/window-service";
import type { WorkspaceService } from "#desktop-rpc/services/workspace-service";

export interface AppRpcRoot extends RpcTarget {
  readonly window: WindowService;
  readonly projectLibrary: ProjectLibraryService;
  readonly workspace: WorkspaceService;
  readonly settings: SettingsService;
}
