import { useEffect, useState } from "react";

import type { WorktreeChangesEvent } from "#shared/rpc/worktree-changes";

import { useWorktreeChanges } from "./branch-scopes";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useWorktreeScmRevision(): number {
  const changesHandle = useWorktreeChanges();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let canceled = false;
    let abortSubscription: (() => void) | null = null;

    void changesHandle
      .subscribe()
      .then((stream) => {
        if (canceled) {
          void stream
            .cancel("Worktree changes revision subscription disposed.")
            .catch(() => undefined);
          return;
        }

        const abortController = new AbortController();
        abortSubscription = () => {
          abortController.abort();
        };

        void stream
          .pipeTo(
            new WritableStream<WorktreeChangesEvent>({
              write: (event) => {
                if (event.kind === "snapshot") {
                  setRevision(event.snapshot.revision);
                } else {
                  setRevision(event.delta.toRevision);
                }
              },
            }),
            { signal: abortController.signal },
          )
          .catch((error) => {
            if (!canceled && !isAbortError(error)) {
              setRevision(0);
            }
          })
          .finally(() => {
            if (!canceled) {
              abortSubscription = null;
            }
          });
      })
      .catch(() => {
        if (!canceled) {
          setRevision(0);
        }
      });

    return () => {
      canceled = true;
      abortSubscription?.();
    };
  }, [changesHandle]);

  return revision;
}
