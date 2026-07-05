import { molecule, use } from "bunshi/react";
import { atomWithReducer } from "jotai/utils";

import { branchNameScope } from "../../../branch/branch-scopes";
import { projectIdScope } from "../../../state/molecules";
import { manuscriptTreeReducer } from "./manuscript-tree-reducer";
import { initialManuscriptTreeState } from "./types";

type RevealHandler = (id: string) => void;

export const manuscriptTreeMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const treeAtom = atomWithReducer(initialManuscriptTreeState, manuscriptTreeReducer);
  const revealHandlers = new Set<RevealHandler>();

  return {
    treeAtom,
    onRevealRequest: (handler: RevealHandler): (() => void) => {
      revealHandlers.add(handler);
      return () => revealHandlers.delete(handler);
    },
    revealInTree: (id: string): void => {
      revealHandlers.forEach((handler) => handler(id));
    },
  };
});
