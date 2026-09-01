import type { ProjectMetadata } from "@novelevolver/domain/project";
import type { RpcTarget } from "capnweb";

export interface ProjectLibraryService extends RpcTarget {
  readonly recentProjects: ProjectMetadata[];
  showOpenDialog(): Promise<ProjectMetadata | null>;
  showCreateDialog(): Promise<ProjectMetadata | null>;
  removeProject(id: number): boolean;
}
