import type { DatabaseSync } from "node:sqlite";

export type AiConversationStatus = "active" | "archived";

export type AiConversationListStatusFilter = AiConversationStatus | "all";

export type AiConversationSummaryRecord = {
  id: string;
  projectId: number;
  title: string;
  titleCustomized: boolean;
  status: AiConversationStatus;
  createdAt: number;
  updatedAt: number;
  adapterKind: string;
  model: string;
  selectedModelId: string;
  selectedAgentId: string;
  /** Session reasoning effort; null when unset / unsupported. */
  selectedReasoningLevel: string | null;
  scenarioId: string | null;
  /** Used only to derive list activity for persisted rows. */
  hasPendingToolBatch: boolean;
};

export type AiConversationRecord = Omit<AiConversationSummaryRecord, "hasPendingToolBatch"> & {
  messagesJson: string;
  historyJson: string;
  pendingToolBatchJson: string | null;
  warningsJson: string;
  errorMessage: string | null;
};

export type AiConversationSearchRecord = AiConversationSummaryRecord & {
  messagesJson: string;
};

type AiConversationSummaryRow = {
  id: string;
  project_id: number;
  title: string;
  title_customized: number | null;
  status: string;
  created_at: number;
  updated_at: number;
  adapter_kind: string;
  model: string;
  selected_model_id: string | null;
  selected_agent_id: string | null;
  selected_reasoning_level: string | null;
  scenario_id: string | null;
  pending_tool_batch_json: string | null;
};

type AiConversationRow = AiConversationSummaryRow & {
  messages_json: string;
  history_json: string;
  warnings_json: string;
  error_message: string | null;
};

type AiConversationSearchRow = AiConversationSummaryRow & {
  messages_json: string;
};

const SUMMARY_COLUMNS = `
  id, project_id, title, title_customized, status, created_at, updated_at,
  adapter_kind, model, selected_model_id, selected_agent_id, selected_reasoning_level,
  scenario_id, pending_tool_batch_json
`;

const FULL_COLUMNS = `
  ${SUMMARY_COLUMNS}, messages_json, history_json, warnings_json, error_message
`;

function toStatus(value: string): AiConversationStatus {
  return value === "archived" ? "archived" : "active";
}

function toTitleCustomized(value: number | null | undefined): boolean {
  return value === 1;
}

function toSelectedReasoningLevel(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function rowToSummary(row: AiConversationSummaryRow): AiConversationSummaryRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    titleCustomized: toTitleCustomized(row.title_customized),
    status: toStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    adapterKind: row.adapter_kind,
    model: row.model,
    selectedModelId: row.selected_model_id ?? "",
    selectedAgentId: row.selected_agent_id ?? "builtin-writing-assistant",
    selectedReasoningLevel: toSelectedReasoningLevel(row.selected_reasoning_level),
    scenarioId: row.scenario_id,
    hasPendingToolBatch:
      row.pending_tool_batch_json != null && row.pending_tool_batch_json.trim() !== "",
  };
}

function rowToRecord(row: AiConversationRow): AiConversationRecord {
  const summary = rowToSummary(row);
  return {
    id: summary.id,
    projectId: summary.projectId,
    title: summary.title,
    titleCustomized: summary.titleCustomized,
    status: summary.status,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    adapterKind: summary.adapterKind,
    model: summary.model,
    selectedModelId: summary.selectedModelId,
    selectedAgentId: summary.selectedAgentId,
    selectedReasoningLevel: summary.selectedReasoningLevel,
    scenarioId: summary.scenarioId,
    messagesJson: row.messages_json,
    historyJson: row.history_json,
    pendingToolBatchJson: row.pending_tool_batch_json,
    warningsJson: row.warnings_json,
    errorMessage: row.error_message,
  };
}

function statusWhereClause(status: AiConversationListStatusFilter): string {
  if (status === "all") {
    return "";
  }
  return " AND status = ?";
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/**
 * ai_conversation 表的 query 接口。
 *
 * 不负责建表（schema 由 initAiChatSchema 在 AppDatabase 启动时执行），
 * 也不持有自己的连接，构造时注入共享 DatabaseSync 句柄。
 */
export class AiChatRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  listSummariesByProject(
    projectId: number,
    options?: { status?: AiConversationListStatusFilter },
  ): AiConversationSummaryRecord[] {
    const status = options?.status ?? "active";
    const params: Array<number | string> = [projectId];
    const statusClause = statusWhereClause(status);
    if (status !== "all") {
      params.push(status);
    }

    const rows = this.#db
      .prepare(
        `
        SELECT ${SUMMARY_COLUMNS}
        FROM ai_conversation
        WHERE project_id = ?${statusClause}
        ORDER BY updated_at DESC
        `,
      )
      .all(...params) as AiConversationSummaryRow[];

    return rows.map(rowToSummary);
  }

  /** Full records for active conversations (legacy callers / runtime load). */
  listByProject(projectId: number): AiConversationRecord[] {
    const rows = this.#db
      .prepare(
        `
        SELECT ${FULL_COLUMNS}
        FROM ai_conversation
        WHERE project_id = ? AND status = 'active'
        ORDER BY updated_at DESC
        `,
      )
      .all(projectId) as AiConversationRow[];

    return rows.map(rowToRecord);
  }

  searchByProject(
    projectId: number,
    query: string,
    options?: { includeArchived?: boolean },
  ): AiConversationSearchRecord[] {
    const normalized = query.trim();
    if (normalized === "") {
      return [];
    }

    const like = `%${escapeLikePattern(normalized)}%`;
    const params: Array<number | string> = [projectId, like, like];
    const statusClause = options?.includeArchived ? "" : " AND status = 'active'";

    const rows = this.#db
      .prepare(
        `
        SELECT ${SUMMARY_COLUMNS}, messages_json
        FROM ai_conversation
        WHERE project_id = ?${statusClause}
          AND (title LIKE ? ESCAPE '\\' OR messages_json LIKE ? ESCAPE '\\')
        ORDER BY updated_at DESC
        `,
      )
      .all(...params) as AiConversationSearchRow[];

    return rows.map((row) => ({
      ...rowToSummary(row),
      messagesJson: row.messages_json,
    }));
  }

  getLatestByProject(projectId: number): AiConversationRecord | null {
    const row = this.#db
      .prepare(
        `
        SELECT ${FULL_COLUMNS}
        FROM ai_conversation
        WHERE project_id = ? AND status = 'active'
        ORDER BY updated_at DESC
        LIMIT 1
        `,
      )
      .get(projectId) as AiConversationRow | undefined;

    return row ? rowToRecord(row) : null;
  }

  getById(projectId: number, id: string): AiConversationRecord | null {
    const row = this.#db
      .prepare(
        `
        SELECT ${FULL_COLUMNS}
        FROM ai_conversation
        WHERE project_id = ? AND id = ?
        `,
      )
      .get(projectId, id) as AiConversationRow | undefined;

    return row ? rowToRecord(row) : null;
  }

  upsert(record: AiConversationRecord): void {
    // last_active_at is retained as a legacy NOT NULL column; mirror updated_at.
    this.#db
      .prepare(
        `
        INSERT INTO ai_conversation (
          id, project_id, title, title_customized, status, created_at, updated_at, last_active_at,
          adapter_kind, model, selected_model_id, selected_agent_id, selected_reasoning_level,
          scenario_id, messages_json, history_json, pending_tool_batch_json, warnings_json, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          title = excluded.title,
          title_customized = excluded.title_customized,
          status = excluded.status,
          updated_at = excluded.updated_at,
          last_active_at = excluded.last_active_at,
          adapter_kind = excluded.adapter_kind,
          model = excluded.model,
          selected_model_id = excluded.selected_model_id,
          selected_agent_id = excluded.selected_agent_id,
          selected_reasoning_level = excluded.selected_reasoning_level,
          scenario_id = excluded.scenario_id,
          messages_json = excluded.messages_json,
          history_json = excluded.history_json,
          pending_tool_batch_json = excluded.pending_tool_batch_json,
          warnings_json = excluded.warnings_json,
          error_message = excluded.error_message
        `,
      )
      .run(
        record.id,
        record.projectId,
        record.title,
        record.titleCustomized ? 1 : 0,
        record.status,
        record.createdAt,
        record.updatedAt,
        record.updatedAt,
        record.adapterKind,
        record.model,
        record.selectedModelId,
        record.selectedAgentId,
        record.selectedReasoningLevel,
        record.scenarioId,
        record.messagesJson,
        record.historyJson,
        record.pendingToolBatchJson,
        record.warningsJson,
        record.errorMessage,
      );
  }

  deleteById(projectId: number, id: string): boolean {
    const result = this.#db
      .prepare(
        `
        DELETE FROM ai_conversation
        WHERE project_id = ? AND id = ?
        `,
      )
      .run(projectId, id);
    return Number(result.changes ?? 0) > 0;
  }

  setStatus(projectId: number, id: string, status: AiConversationStatus): boolean {
    const now = Date.now();
    const result = this.#db
      .prepare(
        `
        UPDATE ai_conversation
        SET status = ?, updated_at = ?, last_active_at = ?
        WHERE project_id = ? AND id = ?
        `,
      )
      .run(status, now, now, projectId, id);
    return Number(result.changes ?? 0) > 0;
  }

  updateTitle(projectId: number, id: string, title: string, titleCustomized: boolean): boolean {
    const now = Date.now();
    const result = this.#db
      .prepare(
        `
        UPDATE ai_conversation
        SET title = ?, title_customized = ?, updated_at = ?, last_active_at = ?
        WHERE project_id = ? AND id = ?
        `,
      )
      .run(title, titleCustomized ? 1 : 0, now, now, projectId, id);
    return Number(result.changes ?? 0) > 0;
  }
}
