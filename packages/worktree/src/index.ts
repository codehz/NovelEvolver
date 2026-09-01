export type { DatabasePort, SqlRunResult, SqlStatement, SqlValue } from "./db/database-port";
export {
  initAppState,
  initAiChatSchema,
  initProjectsSchema,
  initWorktreeSchema,
} from "./db/schema";
export { ProjectsRepository, type ProjectDbRecord } from "./db/projects-repo";
export {
  AiChatRepository,
  type AiConversationListStatusFilter,
  type AiConversationRecord,
  type AiConversationSearchRecord,
  type AiConversationSummaryRecord,
} from "./db/ai-chat-repo";
export {
  WorktreeRepository,
  type ManuscriptNodeCommittedRow,
  type ManuscriptNodeCurrentRow,
  type ResourceNodeCommittedRow,
  type ResourceNodeCurrentRow,
  type WorktreeBlobRecord,
  type WorktreeJournalActor,
  type WorktreeJournalDomain,
  type WorktreeJournalEntityKind,
  type WorktreeJournalEntryRecord,
  type WorktreeJournalOperationKind,
  type WorktreeJournalSource,
  type WorktreeRecord,
} from "./db/worktree-repo";
export { WorktreeSession } from "./session";
export type {
  AiProjectNodeInfo,
  AiProjectStructure,
  AiProjectStructureDomain,
  AiProjectStructureManuscriptNode,
  AiProjectStructureResourceNode,
  AiProjectStructureTarget,
  AiTextDocumentInfo,
} from "./session";
export type { ObjectDatabase } from "./git/diff-utils";
export { RpcStreamPublisher } from "./stream-publisher";
