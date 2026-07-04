import { molecule, use } from "bunshi/react";
import { atom } from "jotai";
import { atomWithReducer } from "jotai/utils";

import { branchNameScope } from "../../demo/branch/branch-scopes";
import { projectIdScope } from "../../demo/state/molecules";
import { flattenManuscriptTree } from "../manuscript-tree";
import { manuscriptTreeReducer } from "./manuscript-tree-reducer";
import { initialManuscriptTreeState } from "./types";

export const manuscriptTreeMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const treeAtom = atomWithReducer(initialManuscriptTreeState, manuscriptTreeReducer);

  const flatItemsAtom = atom((get) => {
    const state = get(treeAtom);
    if (state.outline === null) {
      return [];
    }
    return flattenManuscriptTree(state.outline, state.expandedIds);
  });

  return {
    treeAtom,
    flatItemsAtom,
  };
});
