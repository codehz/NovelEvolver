import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";

export function useResourceTreeSync(): void {
  const resources = useResourceLibrary();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loadStart" });
    void resources
      .getTree()
      .then((snapshot) => {
        if (!cancelled) {
          dispatch({ type: "loadSuccess", snapshot });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          dispatch({
            type: "loadError",
            message: error instanceof Error ? error.message : "加载资源库失败",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, resources]);
}
