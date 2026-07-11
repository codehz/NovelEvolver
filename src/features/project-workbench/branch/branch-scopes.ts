import { createScope, molecule, use, useMolecule } from "bunshi/react";
import type { RpcPromise } from "capnweb";
import { atom, useSetAtom } from "jotai";

import { wrapDisposable } from "#app/shared/lib/rpc/rpc-utils";
import type { AiChatHandle } from "#shared/rpc/ai/index";
import type { BranchWorkspace } from "#shared/rpc/session/index";
import type { HistoryHandle } from "#shared/rpc/worktree/index";
import type { ManuscriptHandle } from "#shared/rpc/worktree/index";
import type { ResourceLibraryHandle } from "#shared/rpc/worktree/index";
import type { WorktreeChangesHandle } from "#shared/rpc/worktree/index";
import type { WorktreeSearchHandle } from "#shared/rpc/worktree/index";

import { projectMolecule } from "../state/molecules";

export const DEFAULT_BRANCH_NAME = "main";

export const activeBranchAtomMolecule = molecule(() => {
  const project = use(projectMolecule);
  return atom(Promise.resolve(project.currentBranch.name) as Promise<string> | string);
});

/** 返回 activeBranchAtom 的 setter，用于在切换分支后更新 atom 值。 */
export function useSetActiveBranchAtom() {
  return useSetAtom(useMolecule(activeBranchAtomMolecule));
}

/** 当前工作台所操作的分支名（与仓库 HEAD 同步，由 BranchScopeProvider 与切换逻辑维护）。 */
export const branchNameScope = createScope<string>(DEFAULT_BRANCH_NAME);

const activeBranchNameMolecule = molecule(() => use(branchNameScope));

/** 当前分支对应的草稿工作区 RPC 引用（随 project × branchName scope 重建）。 */
export const branchWorkspaceMolecule = molecule(() => {
  const project = use(projectMolecule);
  const branchName = use(branchNameScope);
  return wrapDisposable(project.openBranchWorkspace(branchName));
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

/** 项目级 AI 对话句柄（`openProject(...).ai`，跨分支共享）。 */
export const aiChatMolecule = molecule(() => use(projectMolecule).ai);

export function useActiveBranchName(): string {
  return useMolecule(activeBranchNameMolecule);
}

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

export function useAiChat(): RpcPromise<AiChatHandle> {
  return useMolecule(aiChatMolecule);
}
