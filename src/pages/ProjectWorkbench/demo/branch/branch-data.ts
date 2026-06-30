import type { BranchInfo } from "@shared/rpc/projects-rpc";
import { molecule, use, useMolecule } from "bunshi/react";
import { nullthrow } from "foxact/nullthrow";

import { createAsyncLoader, useAsyncLoader } from "@/lib/async-loader";

import { projectScope } from "../state/molecules";

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
