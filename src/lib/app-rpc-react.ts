import { useEffect, useState } from "react";

import type { WindowState } from "@shared/window";
import { projectsService, windowService } from "./app-rpc";
import { subscribeWindowState } from "./window-state-subscription";

export function useWindowService() {
  return windowService;
}

export function useProjectsService() {
  return projectsService;
}

export function useWindowState(fallback: WindowState): WindowState {
  const [state, setState] = useState<WindowState>(fallback);

  useEffect(() => {
    return subscribeWindowState({
      onState: setState,
      onError: () => {
        setState(fallback);
      },
    });
  }, [fallback]);

  return state;
}
