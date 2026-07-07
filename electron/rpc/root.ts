import { RpcTarget } from "capnweb";

import type { AppRpcRoot } from "#shared/rpc/app-rpc";
import type { ProjectLibraryService } from "#shared/rpc/project-library-rpc";
import type { WindowService } from "#shared/rpc/window-rpc";
import type { WorkspaceService } from "#shared/rpc/workspace-rpc";

import type { ProjectLibraryServiceImpl } from "./project-library-service";
import type { WindowServiceImpl } from "./window-service";
import type { WorkspaceServiceImpl } from "./workspace-service";

export class AppRpcRootImpl extends RpcTarget implements AppRpcRoot {
  readonly #windowService: WindowServiceImpl;
  readonly #projectLibraryService: ProjectLibraryServiceImpl;
  readonly #workspaceService: WorkspaceServiceImpl;

  constructor(
    windowService: WindowServiceImpl,
    projectLibraryService: ProjectLibraryServiceImpl,
    workspaceService: WorkspaceServiceImpl,
  ) {
    super();
    this.#windowService = windowService;
    this.#projectLibraryService = projectLibraryService;
    this.#workspaceService = workspaceService;
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

  [Symbol.dispose](): void {
    this.#windowService[Symbol.dispose]();
  }
}
