import { Database as BunDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import {
  initAppState,
  ProjectsRepository,
  WorktreeRepository,
  WorktreeSession,
  type DatabasePort,
  type SqlValue,
} from "@novelevolver/worktree";
import { createSqliteRepository } from "nano-git/repository/sqlite";
import type { SqliteDatabase } from "nano-git/types/sqlite";

function asBunPort(db: BunDatabase, options: { singleStatement?: boolean } = {}): DatabasePort {
  return {
    exec(sql: string): void {
      const trimmed = sql.trim().replace(/;\s*$/, "");
      if (options.singleStatement === true && trimmed.includes(";")) {
        throw new Error("DatabasePort.exec only accepts one SQL statement");
      }
      db.exec(trimmed);
    },
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        run(...params: SqlValue[]) {
          const result = statement.run(...params);
          return { changes: Number(result.changes) };
        },
        get(...params: SqlValue[]) {
          return statement.get(...params) ?? null;
        },
        all(...params: SqlValue[]) {
          return statement.all(...params);
        },
      };
    },
  };
}

function adaptGit(db: BunDatabase): SqliteDatabase {
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
    transaction<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) {
      const wrapped = db.transaction(fn as unknown as (...args: never[]) => TResult);
      return (...args: TArgs) => wrapped(...(args as unknown as never[]));
    },
  };
}

function author() {
  return { name: "Test", email: "test@example.com" };
}

describe("WorktreeSession", () => {
  test("initAppState creates worktree tables with single-statement exec", () => {
    const appDb = new BunDatabase(":memory:");
    const port = asBunPort(appDb, { singleStatement: true });
    initAppState(port);
    const tables = appDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "manuscript_node_committed",
        "manuscript_node_current",
        "projects",
        "resource_node_committed",
        "resource_node_current",
        "worktree",
        "worktree_blob",
        "worktree_journal_entry",
        "ai_conversation",
      ]),
    );
  });

  test("persists drafts and commits only manuscript and resources trees", () => {
    const appDb = new BunDatabase(":memory:");
    const port = asBunPort(appDb);
    initAppState(port);
    const projects = new ProjectsRepository(port);
    const worktrees = new WorktreeRepository(port);
    const project = projects.upsertByPath("/tmp/test.npk", Date.now());

    const repositoryDb = new BunDatabase(":memory:");
    const repository = createSqliteRepository(adaptGit(repositoryDb));
    const extra = repository.writeBlob(Buffer.from("resource"));
    const initialTree = repository.createTree([
      { mode: "100644", name: "resource.txt", hash: extra },
    ]);
    const initialCommit = repository.createCommit(initialTree, [], "initial", {
      ...author(),
      timestamp: 0,
      timezone: "+0000",
    });
    repository.updateRef("refs/heads/main", initialCommit);

    const session = new WorktreeSession(
      worktrees,
      repository.objects,
      repository,
      project.id,
      "main",
    );
    expect(session.warning).toBeNull();
    const folder = session.createManuscriptFolder("root", "第一幕");
    const chapter = session.createManuscriptChapter(folder.nodeId, "开场");
    session.writeChapter(chapter.nodeId, "正文");
    const resourceFile = session.createResourceFile("root", "设定.md");
    session.writeResourceFile(resourceFile.nodeId, "角色");
    expect(session.hasPendingChanges()).toBe(true);

    const reopened = new WorktreeSession(
      worktrees,
      repository.objects,
      repository,
      project.id,
      "main",
    );
    expect(reopened.readChapter(chapter.nodeId)).toBe("正文");
    expect(reopened.getManuscriptOutline().nodes[folder.nodeId]).toMatchObject({
      type: "folder",
      title: "第一幕",
    });
    expect(reopened.getResourceTree().nodes[resourceFile.nodeId]).toMatchObject({
      type: "file",
      name: "设定.md",
    });
    expect(reopened.readResourceFile(resourceFile.nodeId)).toBe("角色");
    expect(reopened.hasPendingChanges()).toBe(true);
    reopened.commitChanges("添加开场", author());
    expect(reopened.hasPendingChanges()).toBe(false);

    const commitHash = repository.readBranch("main");
    expect(commitHash).not.toBeNull();
    if (commitHash !== null) {
      const commit = repository.catFile(commitHash);
      if (commit.type !== "commit") throw new Error("expected commit");
      const rootEntries = repository.catFile(commit.tree);
      if (rootEntries.type !== "tree") throw new Error("expected tree");
      expect(rootEntries.entries.map((entry) => entry.name).sort()).toEqual([
        "manuscript",
        "resources",
      ]);
    }

    session[Symbol.dispose]();
    reopened[Symbol.dispose]();
  });
});
