import { useEffect, useState } from "react";

import { consumeRpcSubscription } from "#app/lib/app-rpc-react";
import type { ChangesEvent } from "#shared/rpc/worktree-changes-rpc";

import { useWorktreeChanges } from "./branch-scopes";

export function useWorktreeChangesRevision(): number {
  const changesHandle = useWorktreeChanges();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    return consumeRpcSubscription<ChangesEvent>({
      subscribe: () => changesHandle.subscribeChanges(),
      onValue: (event) => {
        if (event.kind === "snapshot") {
          setRevision(event.snapshot.revision);
        } else {
          setRevision(event.delta.toRevision);
        }
      },
      onError: () => {
        setRevision(0);
      },
      cancelReason: "Worktree changes revision subscription disposed.",
    });
  }, [changesHandle]);

  return revision;
}
