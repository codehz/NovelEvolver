import type { ProjectLibraryService } from "@novelevolver/desktop-rpc/services/project-library-service";
import type { SettingsService } from "@novelevolver/desktop-rpc/services/settings-service";
import type { WindowService } from "@novelevolver/desktop-rpc/services/window-service";
import type { WorkspaceService } from "@novelevolver/desktop-rpc/services/workspace-service";
import type { RpcTarget } from "capnweb";

export interface AppRpcRoot extends RpcTarget {
  readonly window: WindowService;
  readonly projectLibrary: ProjectLibraryService;
  readonly workspace: WorkspaceService;
  readonly settings: SettingsService;
}
