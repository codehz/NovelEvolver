import { useEffect, useState } from "react";

import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";
import type { ChangesEvent } from "#shared/rpc/worktree-changes-rpc";
import type { WorktreeTreeSnapshot } from "#shared/rpc/worktree-tree-rpc";

import { useWorktreeChanges } from "../branch/branch-scopes";
import { applyCombinedWorktreeTreeFromChangesEvent } from "./worktree-tree-state";

export function useWorktreeTreeSnapshot(): WorktreeTreeSnapshot | null {
  const changesHandle = useWorktreeChanges();
  const [snapshot, setSnapshot] = useState<WorktreeTreeSnapshot | null>(null);

  useEffect(() => {
    return consumeRpcSubscription<ChangesEvent>({
      subscribe: () => changesHandle.subscribeChanges(),
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
