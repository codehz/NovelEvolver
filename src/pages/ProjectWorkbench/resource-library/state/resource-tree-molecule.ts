import { molecule, use } from "bunshi/react";
import { atom } from "jotai";
import { atomWithReducer } from "jotai/utils";

import { branchNameScope } from "../../demo/branch/branch-scopes";
import { projectIdScope } from "../../demo/state/molecules";
import { buildFlatRenderItems, resourceTreeReducer } from "./tree-data-reducer";
import { initialResourceTreeState } from "./types";

type RevealHandler = (path: string) => void;

export const resourceLibraryTreeMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const treeAtom = atomWithReducer(initialResourceTreeState, resourceTreeReducer);
  const flatRenderItemsAtom = atom((get) => buildFlatRenderItems(get(treeAtom)));
  const selectedPathAtom = atom((get) => get(treeAtom).selected?.path ?? null);

  const revealHandlers = new Set<RevealHandler>();

  return {
    treeAtom,
    flatRenderItemsAtom,
    selectedPathAtom,
    onRevealRequest: (handler: RevealHandler): (() => void) => {
      revealHandlers.add(handler);
      return () => revealHandlers.delete(handler);
    },
    revealInTree: (path: string): void => {
      revealHandlers.forEach((handler) => handler(path));
    },
  };
});
