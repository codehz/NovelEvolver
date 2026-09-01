import type { AppRpcRoot } from "@novelevolver/desktop-rpc/root/index";
import type { ProjectLibraryService } from "@novelevolver/desktop-rpc/services/project-library-service";
import type { SettingsService } from "@novelevolver/desktop-rpc/services/settings-service";
import type { WindowService } from "@novelevolver/desktop-rpc/services/window-service";
import type { WorkspaceService } from "@novelevolver/desktop-rpc/services/workspace-service";
import { RpcTarget } from "capnweb";

import type { ProjectLibraryServiceImpl } from "../services/project-library-service";
import type { SettingsServiceImpl } from "../services/settings-service";
import type { WindowServiceImpl } from "../services/window-service";
import type { WorkspaceServiceImpl } from "../services/workspace-service";

export class AppRpcRootImpl extends RpcTarget implements AppRpcRoot {
  readonly #windowService: WindowServiceImpl;
  readonly #projectLibraryService: ProjectLibraryServiceImpl;
  readonly #workspaceService: WorkspaceServiceImpl;
  readonly #settingsService: SettingsServiceImpl;

  constructor(
    windowService: WindowServiceImpl,
    projectLibraryService: ProjectLibraryServiceImpl,
    workspaceService: WorkspaceServiceImpl,
    settingsService: SettingsServiceImpl,
  ) {
    super();
    this.#windowService = windowService;
    this.#projectLibraryService = projectLibraryService;
    this.#workspaceService = workspaceService;
    this.#settingsService = settingsService;
  }

  get window(): WindowService {
    return this.#windowService;
  }

  get projectLibrary(): ProjectLibraryService {
    return this.#projectLibraryService;
  }

  get workspace(): WorkspaceService {
    return this.#workspaceService;
  }

  get settings(): SettingsService {
    return this.#settingsService;
  }

  [Symbol.dispose](): void {
    this.#windowService[Symbol.dispose]();
    this.#workspaceService[Symbol.dispose]();
  }
}
