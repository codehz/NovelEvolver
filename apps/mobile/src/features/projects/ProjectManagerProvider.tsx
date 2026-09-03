import type { ProjectDbRecord } from "@novelevolver/worktree";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

import { projectStorage, type OpenedProject } from "./git/repository-manager";

export type ProjectManagerContextValue = {
  records: ProjectDbRecord[];
  opened: OpenedProject | null;
  refresh: () => void;
  importProject(): Promise<string | null>;
  createEmpty(name: string): Promise<OpenedProject>;
  openProject(record: ProjectDbRecord): Promise<OpenedProject>;
  deleteProject(id: number): Promise<void>;
  renameProject(id: number, displayName: string): ProjectDbRecord;
  shareProject(id: number): void;
};

const ProjectManagerContext = createContext<ProjectManagerContextValue | null>(null);

export function ProjectManagerProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState(() => {
    projectStorage.syncFromDisk();
    return projectStorage.records;
  });
  const [opened, setOpened] = useState<OpenedProject | null>(projectStorage.opened);

  const refresh = useCallback(() => {
    projectStorage.syncFromDisk();
    setRecords(projectStorage.records);
    setOpened(projectStorage.opened);
  }, []);

  useEffect(() => () => projectStorage.close(), []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo<ProjectManagerContextValue>(
    () => ({
      records,
      opened,
      refresh,
      async importProject() {
        const fileName = await projectStorage.importProject();
        refresh();
        return fileName;
      },
      async createEmpty(name) {
        const result = await projectStorage.createEmpty(name);
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
      shareProject(id) {
        projectStorage.share(id);
      },
    }),
    [opened, records, refresh],
  );
  return <ProjectManagerContext.Provider value={value}>{children}</ProjectManagerContext.Provider>;
}

export function useProjectManager(): ProjectManagerContextValue {
  const value = useContext(ProjectManagerContext);
  if (value === null) throw new Error("ProjectManagerProvider is missing");
  return value;
}
