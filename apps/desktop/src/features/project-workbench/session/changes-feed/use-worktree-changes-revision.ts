import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { worktreeChangesFeedMolecule } from "./worktree-changes-feed";

export function useWorktreeChangesRevision(): number {
  const { revisionAtom } = useMolecule(worktreeChangesFeedMolecule);
  return useAtomValue(revisionAtom);
}
