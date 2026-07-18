import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

import { worktreeChangesFeedMolecule } from "#workbench/worktree/worktree-changes-feed";

import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";

export function useManuscriptTreeSync(): void {
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const dispatch = useSetAtom(treeAtom);
  const { treeSnapshotAtom, lastEventAtom, statusAtom } = useMolecule(worktreeChangesFeedMolecule);
  const treeSnapshot = useAtomValue(treeSnapshotAtom);
  const lastEvent = useAtomValue(lastEventAtom);
  const status = useAtomValue(statusAtom);
  const appliedRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "loading") {
      appliedRevisionRef.current = null;
      dispatch({ type: "loadStart" });
      return;
    }
    if (status === "error") {
      appliedRevisionRef.current = null;
      dispatch({ type: "loadError", message: "加载正文失败" });
      return;
    }
    if (treeSnapshot === null) {
      return;
    }
    if (appliedRevisionRef.current === treeSnapshot.revision) {
      return;
    }

    const previousRevision = appliedRevisionRef.current;
    appliedRevisionRef.current = treeSnapshot.revision;

    const patch = lastEvent?.kind === "delta" ? lastEvent.treeDelta?.manuscript : undefined;
    if (previousRevision !== null && patch !== undefined && lastEvent?.kind === "delta") {
      dispatch({
        type: "applyDelta",
        delta: patch,
        revision: lastEvent.delta.toRevision,
      });
      return;
    }

    dispatch({ type: "loadSuccess", snapshot: treeSnapshot.manuscript });
  }, [dispatch, lastEvent, status, treeSnapshot]);
}
