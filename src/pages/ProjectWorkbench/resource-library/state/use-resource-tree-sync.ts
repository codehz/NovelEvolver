import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { useWorktreeScmRevision } from "../../demo/branch/use-worktree-scm-revision";
import { useTreeLoadSync } from "../../tree/use-tree-load-sync";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";

export function useResourceTreeSync(): void {
  const resources = useResourceLibrary();
  const revision = useWorktreeScmRevision();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatch = useSetAtom(treeAtom);
  const previousRevisionRef = useRef<number | null>(null);

  useTreeLoadSync({
    load: () => resources.getTree(),
    onStart: () => {
      dispatch({ type: "loadStart" });
    },
    onSuccess: (snapshot) => {
      dispatch({ type: "loadSuccess", snapshot });
    },
    onError: (message) => {
      dispatch({ type: "loadError", message });
    },
    fallbackErrorMessage: "加载资源库失败",
    deps: [resources],
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
    void Promise.resolve(resources.getTree())
      .then((snapshot) => {
        if (!cancelled) {
          dispatch({ type: "setSnapshot", snapshot });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [dispatch, resources, revision]);
}
