import { Database } from "@novelevolver/mobile-sqlite";
import {
  initAppState,
  ProjectsRepository,
  WorktreeRepository,
  type DatabasePort,
} from "@novelevolver/worktree";

import { asMobileSqlitePort } from "./mobile-sqlite-port";

export type MobileAppState = {
  db: Database;
  port: DatabasePort;
  projects: ProjectsRepository;
  worktrees: WorktreeRepository;
};

let appState: MobileAppState | null = null;

export function getMobileAppState(): MobileAppState {
  if (appState !== null) {
    return appState;
  }

  const db = Database.open("app-state.db", { location: "novelevolver" });
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const port = asMobileSqlitePort(db);
    initAppState(port);
    appState = {
      db,
      port,
      projects: new ProjectsRepository(port),
      worktrees: new WorktreeRepository(port),
    };
    return appState;
  } catch (error) {
    db.close();
    throw error;
  }
}
