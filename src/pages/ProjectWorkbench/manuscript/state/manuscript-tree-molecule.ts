import { molecule, use } from "bunshi/react";
import { atomWithReducer } from "jotai/utils";

import { branchNameScope } from "../../demo/branch/branch-scopes";
import { projectIdScope } from "../../demo/state/molecules";
import { manuscriptTreeReducer } from "./manuscript-tree-reducer";
import { initialManuscriptTreeState } from "./types";

export const manuscriptTreeMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const treeAtom = atomWithReducer(initialManuscriptTreeState, manuscriptTreeReducer);

  return {
    treeAtom,
  };
});
