import { useEffectEvent, useLayoutEffect } from "react";

import type {
  WorkbenchEditorNavigationRequest,
  WorkbenchEditorNavigationRequestResult,
} from "../state/types";

type UseWorkbenchEditorNavigationRequestOptions = {
  onNavigationRequest: (
    handler: (request: WorkbenchEditorNavigationRequest) => WorkbenchEditorNavigationRequestResult,
  ) => () => void;
  retryPendingNavigation: () => void;
  consume: (request: WorkbenchEditorNavigationRequest) => WorkbenchEditorNavigationRequestResult;
  retryDeps?: readonly unknown[];
};

export function useWorkbenchEditorNavigationRequest({
  onNavigationRequest,
  retryPendingNavigation,
  consume,
  retryDeps = [],
}: UseWorkbenchEditorNavigationRequestOptions): void {
  const runConsume = useEffectEvent((request: WorkbenchEditorNavigationRequest) =>
    consume(request),
  );

  useLayoutEffect(() => onNavigationRequest(runConsume), [onNavigationRequest, runConsume]);

  useLayoutEffect(() => {
    retryPendingNavigation();
  }, [retryPendingNavigation, ...retryDeps]);
}
