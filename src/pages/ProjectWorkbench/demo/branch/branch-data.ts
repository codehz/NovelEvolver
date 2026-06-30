import type { BranchInfo } from "@shared/rpc/projects-rpc";
import { molecule, use, useMolecule } from "bunshi/react";
import { nullthrow } from "foxact/nullthrow";
import { atom } from "jotai";

import { createAsyncLoader, useAsyncLoader } from "@/lib/async-loader";

import { projectScope } from "../state/molecules";

export const branchSwitcherOpenAtom = atom(false);

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
