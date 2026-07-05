import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

import { useManuscript } from "../../demo/branch/branch-scopes";
import { useWorktreeScmRevision } from "../../demo/branch/use-worktree-scm-revision";
import { useTreeLoadSync } from "../../tree/use-tree-load-sync";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";

export function useManuscriptTreeSync(): void {
  const manuscript = useManuscript();
  const revision = useWorktreeScmRevision();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const dispatch = useSetAtom(treeAtom);
  const previousRevisionRef = useRef<number | null>(null);

  useTreeLoadSync({
    load: () => manuscript.getOutline(),
    onStart: () => {
      dispatch({ type: "loadStart" });
    },
    onSuccess: (outline) => {
      dispatch({ type: "loadSuccess", outline });
    },
    onError: (message) => {
      dispatch({ type: "loadError", message });
    },
    fallbackErrorMessage: "加载正文失败",
    deps: [manuscript],
  });

  useEffect(() => {
    if (previousRevisionRef.current === null) {
      previousRevisionRef.current = revision;
      return;
    }
    if (previousRevisionRef.current === revision) {
      return;
    }
    previousRevisionRef.current = revision;

    let cancelled = false;
    void Promise.resolve(manuscript.getOutline())
      .then((outline) => {
        if (!cancelled) {
          dispatch({ type: "setOutline", outline });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [dispatch, manuscript, revision]);
}
