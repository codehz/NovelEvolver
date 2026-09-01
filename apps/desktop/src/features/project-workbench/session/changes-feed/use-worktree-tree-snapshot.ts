import type { WorktreeTreeSnapshot } from "@novelevolver/domain/worktree";
import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { worktreeChangesFeedMolecule } from "./worktree-changes-feed";

export function useWorktreeTreeSnapshot(): WorktreeTreeSnapshot | null {
  const { treeSnapshotAtom } = useMolecule(worktreeChangesFeedMolecule);
  return useAtomValue(treeSnapshotAtom);
}
