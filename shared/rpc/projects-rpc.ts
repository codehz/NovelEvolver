import type { ProjectListItem, ProjectRecord } from "@shared/project";

export interface ProjectsService {
  readonly recents: ProjectListItem[];
  getRecent(id: number): Promise<ProjectListItem | null>;
  openProjectDialog(): Promise<ProjectRecord | null>;
  createProjectDialog(): Promise<ProjectRecord | null>;
  recordOpen(id: number): Promise<ProjectRecord | null>;
  removeRecent(id: number): Promise<boolean>;
}
