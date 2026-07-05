import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { WorktreeTreeEvent } from "#shared/rpc/worktree-tree";

import { useWorktreeTree } from "../../demo/branch/branch-scopes";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";

export function useManuscriptTreeSync(): void {
  const tree = useWorktreeTree();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

  useEffect(() => {
    dispatch({ type: "loadStart" });
    return consumeRpcStream<WorktreeTreeEvent>({
      subscribe: () => tree.subscribe(),
      onValue: (event) => {
        if (event.kind === "snapshot") {
          dispatch({ type: "loadSuccess", snapshot: event.snapshot.manuscript });
          return;
        }
        if (event.manuscript !== undefined) {
          dispatch({
            type: "applyDelta",
            delta: event.manuscript,
            revision: event.toRevision,
          });
        }
      },
      onError: () => {
        dispatch({ type: "loadError", message: "加载正文失败" });
      },
      cancelReason: "Manuscript tree subscription disposed.",
    });
  }, [dispatch, tree]);
}
