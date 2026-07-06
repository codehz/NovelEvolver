import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { WorktreeChangesEvent } from "#shared/rpc/worktree-changes";

import { useWorktreeChanges } from "../../../branch/branch-scopes";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";

export function useManuscriptTreeSync(): void {
  const changesHandle = useWorktreeChanges();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

  useEffect(() => {
    dispatch({ type: "loadStart" });
    return consumeRpcStream<WorktreeChangesEvent>({
      subscribe: () => changesHandle.subscribe(),
      onValue: (event) => {
        if (event.kind === "snapshot") {
          dispatch({ type: "loadSuccess", snapshot: event.treeSnapshot.manuscript });
          return;
        }
        const patch = event.treeDelta?.manuscript;
        if (patch === undefined) {
          return;
        }
        dispatch({
          type: "applyDelta",
          delta: patch,
          revision: event.delta.toRevision,
        });
      },
      onError: () => {
        dispatch({ type: "loadError", message: "加载正文失败" });
      },
      cancelReason: "Manuscript tree subscription disposed.",
    });
  }, [dispatch, changesHandle]);
}
