import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";

import { useManuscript } from "../../demo/branch/branch-scopes";
import { useTreeLoadSync } from "../../tree/use-tree-load-sync";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";

export function useManuscriptTreeSync(): void {
  const manuscript = useManuscript();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

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
}
