import type {
  AiActiveChatHandle,
  AiCatalogHandle,
  AiConversationsHandle,
  ProjectAi,
} from "@novelevolver/desktop-rpc/ai/handles";
import type { BranchWorkspace } from "@novelevolver/desktop-rpc/session";
import type { HistoryHandle } from "@novelevolver/desktop-rpc/worktree";
import type { ManuscriptHandle } from "@novelevolver/desktop-rpc/worktree";
import type { ResourceLibraryHandle } from "@novelevolver/desktop-rpc/worktree";
import type { WorktreeChangesHandle } from "@novelevolver/desktop-rpc/worktree";
import type { WorktreeSearchHandle } from "@novelevolver/desktop-rpc/worktree";
import { molecule, use, useMolecule } from "bunshi/react";
import type { RpcPromise } from "capnweb";

import { branchNameScope } from "./branch-scope";
import { projectMolecule } from "./project-scope";

/**
 * 当前分支对应的草稿工作区 RPC 引用（随 project × branchName scope 重建）。
 *
 * 生命周期由服务端 `ProjectSession` 缓存拥有（deleteBranch / project dispose 时回收），
 * 不要在 branch scope unmount 时 dispose —— 否则缓存会返回已 dispose 的 zombie，
 * `subscribeChanges` 空流结束，Changes 永久停在 loading。
 */
export const branchWorkspaceMolecule = molecule(() => {
  const project = use(projectMolecule);
  const branchName = use(branchNameScope);
  return project.openBranchWorkspace(branchName);
});

/** 当前分支资源库根（`openBranchWorkspace(...).resources` 级联，不在此 await）。 */
export const resourceLibraryMolecule = molecule(() => use(branchWorkspaceMolecule).resources);

/** 当前分支正文根（`openBranchWorkspace(...).manuscript` 级联，不在此 await）。 */
export const manuscriptMolecule = molecule(() => use(branchWorkspaceMolecule).manuscript);

/** 当前分支全文搜索（`openBranchWorkspace(...).search` 级联，不在此 await）。 */
export const worktreeSearchMolecule = molecule(() => use(branchWorkspaceMolecule).search);

/** 当前分支变更跟踪句柄（`openBranchWorkspace(...).changes` 级联，不在此 await）。 */
export const worktreeChangesMolecule = molecule(() => use(branchWorkspaceMolecule).changes);

/** 当前分支文件历史句柄（`openBranchWorkspace(...).history` 级联，不在此 await）。 */
export const historyMolecule = molecule(() => use(branchWorkspaceMolecule).history);

/** 项目级 AI facade（`openProject(...).ai`，跨分支共享）。 */
export const projectAiMolecule = molecule(() => use(projectMolecule).ai);

/** 活跃会话 State feed（`project.ai.active`）。 */
export const aiActiveChatMolecule = molecule(() => use(projectAiMolecule).active);

/** 会话目录 Directory feed（`project.ai.conversations`）。 */
export const aiConversationsMolecule = molecule(() => use(projectAiMolecule).conversations);

/** 模型 / Agent 目录（`project.ai.catalog`）。 */
export const aiCatalogMolecule = molecule(() => use(projectAiMolecule).catalog);

export function useBranchWorkspace(): RpcPromise<BranchWorkspace> {
  return useMolecule(branchWorkspaceMolecule);
}

export function useResourceLibrary(): RpcPromise<ResourceLibraryHandle> {
  return useMolecule(resourceLibraryMolecule);
}

export function useManuscript(): RpcPromise<ManuscriptHandle> {
  return useMolecule(manuscriptMolecule);
}

export function useWorktreeSearch(): RpcPromise<WorktreeSearchHandle> {
  return useMolecule(worktreeSearchMolecule);
}

export function useWorktreeChanges(): RpcPromise<WorktreeChangesHandle> {
  return useMolecule(worktreeChangesMolecule);
}

export function useHistory(): RpcPromise<HistoryHandle> {
  return useMolecule(historyMolecule);
}

export function useProjectAi(): RpcPromise<ProjectAi> {
  return useMolecule(projectAiMolecule);
}

export function useAiActiveChat(): RpcPromise<AiActiveChatHandle> {
  return useMolecule(aiActiveChatMolecule);
}

export function useAiConversations(): RpcPromise<AiConversationsHandle> {
  return useMolecule(aiConversationsMolecule);
}

export function useAiCatalog(): RpcPromise<AiCatalogHandle> {
  return useMolecule(aiCatalogMolecule);
}
