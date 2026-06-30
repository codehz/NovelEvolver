import type { BranchInfo } from "@shared/rpc/projects-rpc";
import { molecule, use, useMolecule } from "bunshi/react";
import { nullthrow } from "foxact/nullthrow";
import { atom, useAtomValue } from "jotai";

import { createAsyncLoader, useAsyncLoader } from "@/lib/async-loader";

import { projectScope } from "../state/molecules";

/** 演示：本地创建的分支（未接后端）。 */
export const demoCreatedBranchesAtom = atom<BranchInfo[]>([]);

/** 演示：覆盖状态栏/列表中的当前分支名；成功走 RPC 切换后应清空。 */
export const demoHeadOverrideAtom = atom<string | null>(null);

export type BranchPickerSnapshot = {
  branches: BranchInfo[];
  headName: string | null;
};

const branchPickerSnapshotMol = molecule(() => {
  const project = nullthrow(use(projectScope));
  return createAsyncLoader(async (): Promise<BranchPickerSnapshot> => {
    const [branches, head] = await Promise.all([project.handle.branches, project.handle.head]);
    return { branches, headName: head.name };
  });
});

const projectContextMol = molecule(() => nullthrow(use(projectScope)));

export function useProjectContext() {
  return useMolecule(projectContextMol);
}

export function useBranchPickerSnapshot() {
  return useAsyncLoader(useMolecule(branchPickerSnapshotMol));
}

export function normalizeBranchNameInput(raw: string): string {
  return raw.trim();
}

const invalidBranchNamePattern = /[\s~^:?*[\\]/;

export function getBranchNameValidationError(name: string, existing: BranchInfo[]): string | null {
  if (name === "") {
    return "分支名不能为空";
  }
  if (invalidBranchNamePattern.test(name)) {
    return "分支名不能包含空格或 ~ ^ : ? * [ \\";
  }
  if (name.endsWith("/") || name.endsWith(".") || name.includes("..")) {
    return "分支名格式无效";
  }
  const lower = name.toLowerCase();
  if (existing.some((branch) => (branch.name ?? "").toLowerCase() === lower)) {
    return "已存在同名分支";
  }
  return null;
}

export function mergeBranchLists(server: BranchInfo[], demo: BranchInfo[]): BranchInfo[] {
  const seen = new Set<string>();
  const merged: BranchInfo[] = [];
  for (const branch of [...server, ...demo]) {
    const name = branch.name ?? "";
    if (name === "" || seen.has(name)) {
      continue;
    }
    seen.add(name);
    merged.push(branch);
  }
  return merged;
}

export function createDemoBranchInfo(name: string): BranchInfo {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 7);
  return { name, commit: `demo${suffix}` };
}

export function isDemoOnlyBranch(name: string, serverBranches: BranchInfo[]): boolean {
  const lower = name.toLowerCase();
  return !serverBranches.some((branch) => (branch.name ?? "").toLowerCase() === lower);
}

export function useEffectiveHeadName(): string | null {
  const override = useAtomValue(demoHeadOverrideAtom);
  const snapshot = useBranchPickerSnapshot();
  if (override != null) {
    return override;
  }
  return snapshot.data?.headName ?? null;
}
