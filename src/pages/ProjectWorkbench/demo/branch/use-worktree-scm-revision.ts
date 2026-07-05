import { useEffect, useState } from "react";

import type { ScmSnapshot } from "#shared/rpc/worktree-scm";

import { useWorktreeScm } from "./branch-scopes";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useWorktreeScmRevision(): number {
  const scmHandle = useWorktreeScm();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let canceled = false;
    let abortSubscription: (() => void) | null = null;

    void scmHandle
      .subscribeSnapshot()
      .then((stream) => {
        if (canceled) {
          void stream.cancel("Worktree SCM revision subscription disposed.").catch(() => undefined);
          return;
        }

        const abortController = new AbortController();
        abortSubscription = () => {
          abortController.abort();
        };

        void stream
          .pipeTo(
            new WritableStream<ScmSnapshot>({
              write: (snapshot) => {
                setRevision(snapshot.revision);
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
  }, [scmHandle]);

  return revision;
}
