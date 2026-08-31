import type { ProjectDbRecord } from "@novelevolver/worktree";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { projectStorage, type OpenedProject } from "./git/repository-manager";

export type ProjectManagerContextValue = {
  records: ProjectDbRecord[];
  opened: OpenedProject | null;
  refresh(): void;
  createEmpty(name: string): Promise<OpenedProject>;
  importProject(uri: string, fileName: string, confirmed?: boolean): Promise<OpenedProject>;
  openProject(record: ProjectDbRecord): Promise<OpenedProject>;
  deleteProject(id: number): Promise<void>;
  renameProject(id: number, displayName: string): ProjectDbRecord;
};

const ProjectManagerContext = createContext<ProjectManagerContextValue | null>(null);

export function ProjectManagerProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState(() => projectStorage.records);
  const [opened, setOpened] = useState<OpenedProject | null>(projectStorage.opened);

  useEffect(() => () => projectStorage.close(), []);
  const refresh = () => {
    setRecords(projectStorage.records);
    setOpened(projectStorage.opened);
  };
  const value: ProjectManagerContextValue = {
    records,
    opened,
    refresh,
    async createEmpty(name) {
      const result = await projectStorage.createEmpty(name);
      refresh();
      return result;
    },
    async importProject(uri, fileName, confirmed) {
      const result = await projectStorage.importFromFile(uri, fileName, confirmed);
      refresh();
      return result;
    },
    async openProject(record) {
      const result = await projectStorage.open(record);
      refresh();
      return result;
    },
    async deleteProject(id) {
      await projectStorage.delete(id);
      refresh();
    },
    renameProject(id, displayName) {
      const result = projectStorage.rename(id, displayName);
      refresh();
      return result;
    },
  };
  return <ProjectManagerContext.Provider value={value}>{children}</ProjectManagerContext.Provider>;
}

export function useProjectManager(): ProjectManagerContextValue {
  const value = useContext(ProjectManagerContext);
  if (value === null) throw new Error("ProjectManagerProvider is missing");
  return value;
}
