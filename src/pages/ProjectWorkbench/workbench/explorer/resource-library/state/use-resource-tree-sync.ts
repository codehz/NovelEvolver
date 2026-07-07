import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { consumeRpcSubscription } from "#app/lib/app-rpc-react";
import type { ChangesEvent } from "#shared/rpc/worktree-changes-rpc";

import { useWorktreeChanges } from "../../../branch/branch-scopes";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";

export function useResourceTreeSync(): void {
  const changesHandle = useWorktreeChanges();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

  useEffect(() => {
    dispatch({ type: "loadStart" });
    return consumeRpcSubscription<ChangesEvent>({
      subscribe: () => changesHandle.subscribeChanges(),
      onValue: (event) => {
        if (event.kind === "snapshot") {
          dispatch({ type: "loadSuccess", snapshot: event.treeSnapshot.resources });
          return;
        }
        const patch = event.treeDelta?.resources;
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
        dispatch({ type: "loadError", message: "加载资源库失败" });
      },
      cancelReason: "Resource tree subscription disposed.",
    });
  }, [dispatch, changesHandle]);
}
