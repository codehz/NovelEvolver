import type { ChangesEvent } from "@novelevolver/domain/worktree";
import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

import { consumeRpcSubscription } from "#app/shared/lib/rpc/app-rpc-react";

import { useWorktreeChanges } from "../workspace-handles";
import {
  initialWorktreeChangesFeedState,
  reduceWorktreeChangesFeed,
  worktreeChangesFeedMolecule,
} from "./worktree-changes-feed";

/**
 * 在 branch scope 内挂载唯一的 `subscribeChanges` 订阅，写入 feed atom。
 * 应只在 BranchScopeProvider 下调用一次。
 */
export function useWorktreeChangesFeedSync(): void {
  const changesHandle = useWorktreeChanges();
  const { feedAtom, retryKeyAtom } = useMolecule(worktreeChangesFeedMolecule);
  const setFeed = useSetAtom(feedAtom);
  const retryKey = useAtomValue(retryKeyAtom);

  useEffect(() => {
    setFeed(initialWorktreeChangesFeedState);
    return consumeRpcSubscription<ChangesEvent>({
      subscribe: () => changesHandle.subscribeChanges(),
      onValue: (event) => {
        setFeed((current) => reduceWorktreeChangesFeed(current, event));
      },
      onError: () => {
        setFeed((current) => ({
          ...current,
          status: "error",
          lastEvent: null,
        }));
      },
      onComplete: () => {
        // Unexpected clean close with no snapshot must not leave UI spinning forever.
        setFeed((current) =>
          current.status === "loading" ? { ...current, status: "error", lastEvent: null } : current,
        );
      },
      cancelReason: "Worktree changes feed subscription disposed.",
    });
  }, [changesHandle, retryKey, setFeed]);
}
