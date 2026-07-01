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

/** 面包屑点击后发出的"定位到某资源节点"请求；nonce 用于触发重复点击。 */
export type RevealResourceRequest = {
  path: string;
  nonce: number;
};

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

  const revealRequestAtom = atom<RevealResourceRequest | null>(null);

  return {
    treeDataAtom,
    treeUiAtom,
    flatRenderItemsAtom,
    selectedPathAtom,
    revealRequestAtom,
  };
});
