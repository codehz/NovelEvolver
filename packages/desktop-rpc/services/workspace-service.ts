import type { RpcTarget } from "capnweb";

import type { ProjectSession } from "#desktop-rpc/session/project-session";

export interface WorkspaceService extends RpcTarget {
  openProject(projectId: number): ProjectSession;
}
