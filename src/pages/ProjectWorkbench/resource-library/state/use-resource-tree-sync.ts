import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { WorktreeTreeEvent } from "#shared/rpc/worktree-tree";

import { useWorktreeTree } from "../../demo/branch/branch-scopes";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";

export function useResourceTreeSync(): void {
  const tree = useWorktreeTree();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

  useEffect(() => {
    dispatch({ type: "loadStart" });
    return consumeRpcStream<WorktreeTreeEvent>({
      subscribe: () => tree.subscribe(),
      onValue: (event) => {
        if (event.kind === "snapshot") {
          dispatch({ type: "loadSuccess", snapshot: event.snapshot.resources });
          return;
        }
        if (event.resources !== undefined) {
          dispatch({
            type: "applyDelta",
            delta: event.resources,
            revision: event.toRevision,
          });
        }
      },
      onError: () => {
        dispatch({ type: "loadError", message: "加载资源库失败" });
      },
      cancelReason: "Resource tree subscription disposed.",
    });
  }, [dispatch, tree]);
}
