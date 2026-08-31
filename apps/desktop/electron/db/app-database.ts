import { DatabaseSync } from "node:sqlite";

import { initAppState, type DatabasePort } from "@novelevolver/worktree";

import { asNodeSqlitePort } from "./node-sqlite-port";
import { initAiChatSchema } from "./schema/ai-chat-schema";

/**
 * 单一 App 状态数据库容器。
 *
 * 物理上合并 projects.db 与 worktrees.db 为一个 SQLite 文件，使跨模块
 * 外键（worktree.project_id -> projects.id）真正生效，并提供统一事务。
 *
 * projects / worktree 表由 `@novelevolver/worktree` 的 initAppState 建立；
 * AI chat 表仍由本进程 schema 初始化。
 */
export class AppDatabase {
  readonly #db: DatabaseSync;
  readonly port: DatabasePort;

  constructor(dbPath: string) {
    this.#db = new DatabaseSync(dbPath);
    this.#db.exec("PRAGMA foreign_keys = ON;");
    this.#db.exec("PRAGMA journal_mode = WAL;");
    this.#db.exec("PRAGMA busy_timeout = 5000;");
    this.port = asNodeSqlitePort(this.#db);

    initAppState(this.port);
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
