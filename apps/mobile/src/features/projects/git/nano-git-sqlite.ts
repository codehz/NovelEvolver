import { Database } from "@novelevolver/mobile-sqlite";
import type { Repository } from "nano-git/repository/core";
import { createSqliteRepository } from "nano-git/repository/sqlite";

import { adaptMobileSqlite } from "./nano-git-sqlite-adapter";

export type OpenedMobileRepository = {
  repo: Repository;
  db: Database;
  close(): void;
};

export { adaptMobileSqlite } from "./nano-git-sqlite-adapter";

export function openMobileRepository(
  fileName: string,
  location: string,
  readonly = false,
): OpenedMobileRepository {
  const db = Database.open(fileName, { location, readonly });
  try {
    const repo = createSqliteRepository(adaptMobileSqlite(db));
    return {
      repo,
      db,
      close() {
        db.close();
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
