import { useEffect, useState } from "react";

import type { WindowState } from "@shared/window";
import { projectsService, windowService } from "./app-rpc";
import { consumeRpcStream } from "./rpc-stream";

export function useWindowService() {
  return windowService;
}

export function useProjectsService() {
  return projectsService;
}

export function useWindowState(fallback: WindowState): WindowState {
  const [state, setState] = useState<WindowState>(fallback);

  useEffect(() => {
    return consumeRpcStream({
      subscribe: () => windowService.subscribeState(),
      onValue: setState,
      onError: () => {
        setState(fallback);
      },
      cancelReason: "Window state subscription disposed.",
    });
  }, [fallback]);

  return state;
}
