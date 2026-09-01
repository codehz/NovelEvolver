import type { ProjectSession } from "@novelevolver/desktop-rpc/session/project-session";
import type { RpcTarget } from "capnweb";

export interface WorkspaceService extends RpcTarget {
  openProject(projectId: number): ProjectSession;
}
