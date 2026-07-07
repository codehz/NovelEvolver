import { molecule, use } from "bunshi/react";
import { atomWithReducer } from "jotai/utils";

import { createOneShotRequestChannel } from "#app/shared/lib/ui/one-shot-request";

import { branchNameScope } from "../../../branch/branch-scopes";
import { projectIdScope } from "../../../state/molecules";
import { manuscriptTreeReducer } from "./manuscript-tree-reducer";
import { initialManuscriptTreeState } from "./types";

export const manuscriptTreeMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const treeAtom = atomWithReducer(initialManuscriptTreeState, manuscriptTreeReducer);
  const revealChannel = createOneShotRequestChannel<string>();

  return {
    treeAtom,
    onRevealRequest: revealChannel.subscribe,
    retryPendingReveal: revealChannel.replay,
    revealInTree: (id: string): void => {
      revealChannel.publish(id);
    },
  };
});
