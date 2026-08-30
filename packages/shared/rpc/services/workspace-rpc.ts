import type { RpcTarget } from "capnweb";

import type { ProjectSession } from "../session/project-session-rpc";

export interface WorkspaceService extends RpcTarget {
  openProject(projectId: number): ProjectSession;
}
