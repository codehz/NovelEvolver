import { molecule, use } from "bunshi/react";
import { atomWithReducer } from "jotai/utils";
import type { Reducer } from "react";

import { branchNameScope } from "#app/features/project-workbench/session/branch-scope";
import { projectIdScope } from "#app/features/project-workbench/session/project-scope";
import { createOneShotRequestChannel } from "#app/shared/lib/ui/one-shot-request";

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
