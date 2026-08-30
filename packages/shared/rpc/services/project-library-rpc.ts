import type { RpcTarget } from "capnweb";

import type { ProjectMetadata } from "#shared/project";

export interface ProjectLibraryService extends RpcTarget {
  readonly recentProjects: ProjectMetadata[];
  showOpenDialog(): Promise<ProjectMetadata | null>;
  showCreateDialog(): Promise<ProjectMetadata | null>;
  removeProject(id: number): boolean;
}
