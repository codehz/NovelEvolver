import { createContentTreeMolecule } from "../../shared/create-content-tree-molecule";
import { manuscriptTreeReducer } from "./manuscript-tree-reducer";
import { initialManuscriptTreeState } from "./types";

export const manuscriptTreeMolecule = createContentTreeMolecule(
  manuscriptTreeReducer,
  initialManuscriptTreeState,
);
