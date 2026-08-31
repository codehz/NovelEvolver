// @ts-expect-error Bun SQLite is only used by the host-side persistence test.
import { Database as BunDatabase } from "bun:sqlite";
// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";
import { cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Database } from "@novelevolver/mobile-sqlite";
import { createSqliteRepository } from "nano-git/repository/sqlite";
import type { SqliteDatabase } from "nano-git/types/sqlite";

import { WorktreeSession } from "./worktree-session";

function adapt(db: BunDatabase): SqliteDatabase {
  return {
    run(sql, params = []) {
      return db.prepare(sql).run(...params);
    },
    query<TRow = unknown>(sql: string) {
      const statement = db.query(sql);
      return {
        get(...params) {
          return (statement.get(...params) as TRow | undefined) ?? null;
        },
        all(...params) {
          return statement.all(...params) as TRow[];
        },
        run(...params) {
          return statement.run(...params);
        },
      };
    },
    transaction(fn: (...args: never[]) => unknown) {
      return db.transaction(fn);
    },
  };
}

function author() {
  return { name: "Test", email: "test@example.com", timestamp: 0, timezone: "+0000" };
}

describe("WorktreeSession", () => {
  test("persists drafts, commits manuscript data, and preserves other repository trees", () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const repositoryPath = join(tmpdir(), `novelevolver-repository-${suffix}.sqlite`);
    const worktreePath = join(tmpdir(), `novelevolver-worktree-${suffix}.sqlite`);
    const exportPath = join(tmpdir(), `novelevolver-export-${suffix}.npk`);
    const repositoryDb = new BunDatabase(repositoryPath);
    const repository = createSqliteRepository(adapt(repositoryDb));
    const resource = repository.writeBlob(Buffer.from("resource"));
    const initialTree = repository.createTree([
      { mode: "100644", name: "resource.txt", hash: resource },
    ]);
    const initialCommit = repository.createCommit(initialTree, [], "initial", author());
    repository.updateRef("refs/heads/main", initialCommit);

    const worktreeDb = new BunDatabase(worktreePath);
    const session = WorktreeSession.open(worktreeDb as unknown as Database, repository);
    expect(session.warning).toBeNull();
    const folderId = session.createFolder("root", "第一幕");
    const chapterId = session.createChapter(folderId, "开场");
    session.writeChapter(chapterId, "正文");
    expect(session.hasChanges).toBe(true);
    session.flush();
    session.close();
    repositoryDb.close();

    const reopenedRepositoryDb = new BunDatabase(repositoryPath);
    const reopenedRepository = createSqliteRepository(adapt(reopenedRepositoryDb));
    const reopenedWorktreeDb = new BunDatabase(worktreePath);
    const reopened = WorktreeSession.open(
      reopenedWorktreeDb as unknown as Database,
      reopenedRepository,
    );
    expect(reopened.readChapter(chapterId)).toBe("正文");
    expect(reopened.outline.nodes[folderId]).toMatchObject({ type: "folder", title: "第一幕" });
    expect(reopened.hasChanges).toBe(true);
    reopened.commit("添加开场");
    expect(reopened.hasChanges).toBe(false);
    const commitHash = reopenedRepository.readBranch("main");
    expect(commitHash).not.toBeNull();
    if (commitHash !== null) {
      const commit = reopenedRepository.catFile(commitHash);
      if (commit.type !== "commit") throw new Error("expected commit");
      const rootEntries = reopenedRepository.catFile(commit.tree);
      if (rootEntries.type !== "tree") throw new Error("expected tree");
      expect(rootEntries.entries.map((entry) => entry.name)).toEqual([
        "manuscript",
        "resource.txt",
      ]);
    }
    reopened.close();
    reopenedRepositoryDb.close();
    cpSync(repositoryPath, exportPath);
    const exportedDb = new BunDatabase(exportPath);
    const exportedRepository = createSqliteRepository(adapt(exportedDb));
    expect(exportedRepository.readBranch("main")).toBe(commitHash);
    exportedDb.close();
    rmSync(repositoryPath, { force: true });
    rmSync(worktreePath, { force: true });
    rmSync(exportPath, { force: true });
  });

  test("rebuilds an invalid persisted draft from the committed baseline", () => {
    const repositoryDb = new BunDatabase(":memory:");
    const repository = createSqliteRepository(adapt(repositoryDb));
    const worktreeDb = new BunDatabase(":memory:");
    worktreeDb.run("CREATE TABLE worktree_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    worktreeDb.run(
      "INSERT INTO worktree_meta VALUES (?, ?)",
      "state",
      JSON.stringify({ outline: {}, contents: {}, baseOutline: {}, baseContents: {} }),
    );

    const session = WorktreeSession.open(worktreeDb as unknown as Database, repository);
    expect(session.warning).toContain("损坏草稿");
    expect(session.outline.nodes.root).toMatchObject({ type: "folder", children: [] });
    session.close();
    repositoryDb.close();
  });
});
