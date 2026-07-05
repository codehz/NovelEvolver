import { useEffect, useState } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { WorktreeTreeEvent, WorktreeTreeSnapshot } from "#shared/rpc/worktree-tree";

import { applyWorktreeTreeEvent } from "../../tree/worktree-tree-state";
import { useWorktreeTree } from "./branch-scopes";

export function useWorktreeTreeSnapshot(): WorktreeTreeSnapshot | null {
  const treeHandle = useWorktreeTree();
  const [snapshot, setSnapshot] = useState<WorktreeTreeSnapshot | null>(null);

  useEffect(() => {
    return consumeRpcStream<WorktreeTreeEvent>({
      subscribe: () => treeHandle.subscribe(),
      onValue: (event) => {
        setSnapshot((current) => applyWorktreeTreeEvent(current, event));
      },
      onError: () => {
        setSnapshot(null);
      },
      cancelReason: "Worktree tree subscription disposed.",
    });
  }, [treeHandle]);

  return snapshot;
}
