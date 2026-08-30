import { molecule, use } from "bunshi/react";
import { atomWithReducer } from "jotai/utils";
import type { Reducer } from "react";

import { createOneShotRequestChannel } from "#app/shared/lib/ui/one-shot-request";
import { branchNameScope } from "#workbench/session/branch-scope";
import { projectIdScope } from "#workbench/session/project-scope";

export function createContentTreeMolecule<TState, TAction>(
  reducer: Reducer<TState, TAction>,
  initialState: TState,
) {
  return molecule(() => {
    use(projectIdScope);
    use(branchNameScope);

    const treeAtom = atomWithReducer(initialState, reducer);
    const revealChannel = createOneShotRequestChannel<string>();

    return {
      treeAtom,
      onRevealRequest: revealChannel.subscribe,
      retryPendingReveal: revealChannel.replay,
      revealInTree: (targetId: string): void => {
        revealChannel.publish(targetId);
      },
    };
  });
}
