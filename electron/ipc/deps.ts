import type { ProjectsDatabase } from "../projects-db";

export type IpcMainDeps = {
  getProjectsDb: () => ProjectsDatabase;
};