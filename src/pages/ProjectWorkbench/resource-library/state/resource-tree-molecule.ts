import { molecule, use } from "bunshi/react";
import { atom } from "jotai";
import { atomWithReducer } from "jotai/utils";

import { branchNameScope } from "../../demo/branch/branch-scopes";
import { projectIdScope } from "../../demo/state/molecules";
import {
  buildFlatRenderItems,
  flattenResourceTree,
  resourceTreeDataReducer,
} from "./tree-data-reducer";
import { initialResourceTreeUiState, resourceTreeUiReducer } from "./tree-ui-reducer";
import { initialResourceTreeDataState } from "./types";

export const resourceLibraryTreeMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const treeDataAtom = atomWithReducer(initialResourceTreeDataState, resourceTreeDataReducer);
  const treeUiAtom = atomWithReducer(initialResourceTreeUiState, resourceTreeUiReducer);

  const flatRenderItemsAtom = atom((get) => {
    const data = get(treeDataAtom);
    const ui = get(treeUiAtom);
    const flat = flattenResourceTree(data.roots);
    return buildFlatRenderItems(flat, ui.creating);
  });

  const selectedPathAtom = atom((get) => get(treeUiAtom).selected?.path ?? null);

  return {
    treeDataAtom,
    treeUiAtom,
    flatRenderItemsAtom,
    selectedPathAtom,
  };
});
