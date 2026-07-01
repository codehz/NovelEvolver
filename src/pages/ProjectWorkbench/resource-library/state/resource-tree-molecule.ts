import { molecule, use } from "bunshi/react";
import { atom } from "jotai";
import { atomWithReducer } from "jotai/utils";

import { branchNameScope } from "../../demo/branch/branch-scopes";
import { projectIdScope } from "../../demo/state/molecules";
import {
  buildFlatRenderItems,
  flattenVisibleResourceTree,
  resourceTreeDataReducer,
} from "./tree-data-reducer";
import { initialResourceTreeUiState, resourceTreeUiReducer } from "./tree-ui-reducer";
import { initialResourceTreeDataState } from "./types";

type RevealHandler = (path: string) => void;

export const resourceLibraryTreeMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const treeDataAtom = atomWithReducer(initialResourceTreeDataState, resourceTreeDataReducer);
  const treeUiAtom = atomWithReducer(initialResourceTreeUiState, resourceTreeUiReducer);

  const flatRenderItemsAtom = atom((get) => {
    const data = get(treeDataAtom);
    const ui = get(treeUiAtom);
    const flat = flattenVisibleResourceTree(data);
    return buildFlatRenderItems(flat, ui.editing);
  });

  const selectedPathAtom = atom((get) => get(treeUiAtom).selected?.path ?? null);

  const revealHandlers = new Set<RevealHandler>();

  return {
    treeDataAtom,
    treeUiAtom,
    flatRenderItemsAtom,
    selectedPathAtom,
    /** Register a handler for reveal-request commands. Returns an unsubscribe function. */
    onRevealRequest: (handler: RevealHandler): (() => void) => {
      revealHandlers.add(handler);
      return () => revealHandlers.delete(handler);
    },
    /** Command the tree to select and scroll to the given resource path. */
    revealInTree: (path: string): void => {
      revealHandlers.forEach((handler) => handler(path));
    },
  };
});
