import { molecule, use, useMolecule } from "bunshi/react";

import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import type { BranchSummary } from "#shared/rpc/session/index";
import { projectMolecule } from "#workbench/session/project-scope";

export type BranchPickerSnapshot = {
  branches: BranchSummary[];
  headName: string | null;
};

const branchPickerSnapshotMol = molecule(() => {
  const project = use(projectMolecule);
  return createAsyncLoader(async (): Promise<BranchPickerSnapshot> => {
    const [branches, currentBranch] = await Promise.all([project.branches, project.currentBranch]);
    return { branches, headName: currentBranch.name };
  });
});

export function useBranchPickerSnapshot() {
  return useAsyncLoader(useMolecule(branchPickerSnapshotMol));
}

export function normalizeBranchNameInput(raw: string): string {
  return raw.trim();
}

const invalidBranchNamePattern = /[\s~^:?*[\\]/;

export function getBranchNameValidationError(
  name: string,
  existing: BranchSummary[],
): string | null {
  if (name === "") {
    return "分支名不能为空";
  }
  if (name.startsWith("/") || name.startsWith(".")) {
    return "分支名格式无效";
  }
  if (invalidBranchNamePattern.test(name)) {
    return "分支名不能包含空格或 ~ ^ : ? * [ \\";
  }
  if (name.endsWith("/") || name.endsWith(".") || name.includes("..") || name.includes("//")) {
    return "分支名格式无效";
  }
  const lower = name.toLowerCase();
  if (existing.some((branch) => (branch.name ?? "").toLowerCase() === lower)) {
    return "已存在同名分支";
  }
  return null;
}
