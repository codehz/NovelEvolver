import { useEffect, useState } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { WorktreeChangesEvent } from "#shared/rpc/worktree-changes-rpc";
import type { WorktreeTreeSnapshot } from "#shared/rpc/worktree-tree-rpc";

import { applyCombinedWorktreeTreeFromChangesEvent } from "../tree/worktree-tree-state";
import { useWorktreeChanges } from "./branch-scopes";

export function useWorktreeTreeSnapshot(): WorktreeTreeSnapshot | null {
  const changesHandle = useWorktreeChanges();
  const [snapshot, setSnapshot] = useState<WorktreeTreeSnapshot | null>(null);

  useEffect(() => {
    return consumeRpcStream<WorktreeChangesEvent>({
      subscribe: () => changesHandle.subscribe(),
      onValue: (event) => {
        setSnapshot((current) => applyCombinedWorktreeTreeFromChangesEvent(current, event));
      },
      onError: () => {
        setSnapshot(null);
      },
      cancelReason: "Worktree tree subscription disposed.",
    });
  }, [changesHandle]);

  return snapshot;
}
