import { createContentTreeMolecule } from "../../shared/create-content-tree-molecule";
import { resourceTreeReducer } from "./resource-tree-reducer";
import { initialResourceTreeState } from "./types";

export const resourceLibraryTreeMolecule = createContentTreeMolecule(
  resourceTreeReducer,
  initialResourceTreeState,
);
