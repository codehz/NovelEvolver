import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { WorktreeChangesEvent } from "#shared/rpc/worktree-changes";

import { useWorktreeChanges } from "../../../branch/branch-scopes";
import { extractWorktreeTreeFromChanges } from "../../../tree/worktree-tree-state";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";

export function useResourceTreeSync(): void {
  const changesHandle = useWorktreeChanges();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

  useEffect(() => {
    dispatch({ type: "loadStart" });
    return consumeRpcStream<WorktreeChangesEvent>({
      subscribe: () => changesHandle.subscribe(),
      onValue: (event) => {
        const tree = extractWorktreeTreeFromChanges(event);
        if (tree === null) {
          return;
        }
        dispatch({ type: "loadSuccess", snapshot: tree.resources });
      },
      onError: () => {
        dispatch({ type: "loadError", message: "加载资源库失败" });
      },
      cancelReason: "Resource tree subscription disposed.",
    });
  }, [dispatch, changesHandle]);
}
