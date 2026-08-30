export { BranchScopeProvider } from "./BranchScopeProvider";
export {
  activeBranchAtomMolecule,
  branchNameScope,
  DEFAULT_BRANCH_NAME,
  useActiveBranchName,
  useSetActiveBranchAtom,
} from "./branch-scope";
export {
  applyManuscriptTreeDelta,
  applyResourceTreeDelta,
  applyWorktreeTreeDelta,
  applyCombinedWorktreeTreeFromChangesEvent,
} from "./changes-feed/worktree-tree-state";
export {
  applyChangesSnapshotEvent,
  initialWorktreeChangesFeedState,
  reduceWorktreeChangesFeed,
  worktreeChangesFeedMolecule,
  type WorktreeChangesFeedState,
  type WorktreeChangesFeedStatus,
} from "./changes-feed/worktree-changes-feed";
export { useWorktreeChangesFeedSync } from "./changes-feed/use-worktree-changes-feed-sync";
export { useWorktreeChangesRevision } from "./changes-feed/use-worktree-changes-revision";
export { useWorktreeTreeSnapshot } from "./changes-feed/use-worktree-tree-snapshot";
export { projectIdScope, projectMolecule, useProjectContext } from "./project-scope";
export {
  aiActiveChatMolecule,
  aiCatalogMolecule,
  aiConversationsMolecule,
  branchWorkspaceMolecule,
  historyMolecule,
  manuscriptMolecule,
  projectAiMolecule,
  resourceLibraryMolecule,
  useAiActiveChat,
  useAiCatalog,
  useAiConversations,
  useBranchWorkspace,
  useHistory,
  useManuscript,
  useProjectAi,
  useResourceLibrary,
  useWorktreeChanges,
  useWorktreeSearch,
  worktreeChangesMolecule,
  worktreeSearchMolecule,
} from "./workspace-handles";
