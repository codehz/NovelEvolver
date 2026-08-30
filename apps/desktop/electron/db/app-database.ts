import { DatabaseSync } from "node:sqlite";

import { initAiChatSchema } from "./schema/ai-chat-schema";
import { initProjectsSchema } from "./schema/projects-schema";
import { initWorktreeSchema } from "./schema/worktree-schema";

/**
 * 单一 App 状态数据库容器。
 *
 * 物理上合并 projects.db 与 worktrees.db 为一个 SQLite 文件，使跨模块
 * 外键（worktree.project_id -> projects.id）真正生效，并提供统一事务。
 *
 * 逻辑分层通过 schema/* 建表 + repositories/* 提供 query 接口实现，每个
 * repo 只持有本连接的 DatabaseSync 句柄而非自行 open。
 */
export class AppDatabase {
  readonly #db: DatabaseSync;

  constructor(dbPath: string) {
    this.#db = new DatabaseSync(dbPath);
    this.#db.exec("PRAGMA foreign_keys = ON;");
    this.#db.exec("PRAGMA journal_mode = WAL;");
    this.#db.exec("PRAGMA busy_timeout = 5000;");

    // 顺序敏感：worktree / ai_conversation 通过 FK 引用 projects(id)，必须先建 projects。
    initProjectsSchema(this.#db);
    initWorktreeSchema(this.#db);
    initAiChatSchema(this.#db);
  }

  get db(): DatabaseSync {
    return this.#db;
  }

  /**
   * 在单一连接上执行 IMMEDIATE 事务。跨 repo 写入可放进同一事务，
   * 配合 FK ON DELETE CASCADE 实现原子级联清理。
   */
  transaction<T>(operation: () => T): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.#db.close();
  }
}
