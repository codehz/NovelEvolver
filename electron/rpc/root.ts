import { RpcTarget } from "capnweb";

import type { AppRpcRoot } from "@shared/rpc/app-rpc";
import type { ProjectsService } from "@shared/rpc/projects-rpc";
import type { WindowService } from "@shared/rpc/window-rpc";
import type { ProjectsServiceImpl } from "./projects-service";
import type { WindowServiceImpl } from "./window-service";

export class AppRpcRootImpl extends RpcTarget implements AppRpcRoot {
  readonly #windowService: WindowServiceImpl;
  readonly #projectsService: ProjectsServiceImpl;

  constructor(windowService: WindowServiceImpl, projectsService: ProjectsServiceImpl) {
    super();
    this.#windowService = windowService;
    this.#projectsService = projectsService;
  }

  get window(): WindowService {
    return this.#windowService;
  }

  get projects(): ProjectsService {
    return this.#projectsService;
  }

  [Symbol.dispose](): void {
    this.#windowService[Symbol.dispose]();
  }
}
