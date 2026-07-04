import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { useManuscript } from "../../demo/branch/branch-scopes";
import { manuscriptTreeMolecule } from "./manuscript-tree-molecule";

export function useManuscriptTreeSync(): void {
  const manuscript = useManuscript();
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const dispatch = useSetAtom(treeAtom);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "loadStart" });
    void manuscript
      .getOutline()
      .then((outline) => {
        if (!cancelled) {
          dispatch({ type: "loadSuccess", outline });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          dispatch({
            type: "loadError",
            message: error instanceof Error ? error.message : "加载正文失败",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, manuscript]);
}
