import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";

import { useResourceLibrary } from "../../demo/branch/branch-scopes";
import { useTreeLoadSync } from "../../tree/use-tree-load-sync";
import { resourceLibraryTreeMolecule } from "./resource-tree-molecule";

export function useResourceTreeSync(): void {
  const resources = useResourceLibrary();
  const { treeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

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
}
