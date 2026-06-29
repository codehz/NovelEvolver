import { useEffect, useState } from "react";

import type { WindowState } from "@shared/window";
import { projectsService, windowService } from "./app-rpc";

export function useWindowService() {
  return windowService;
}

export function useProjectsService() {
  return projectsService;
}

export function useWindowState(fallback: WindowState): WindowState {
  const [state, setState] = useState<WindowState>(fallback);

  useEffect(() => {
    let disposed = false;
    let subscription: Awaited<ReturnType<typeof windowService.subscribeState>> | null = null;

    class ListenerImpl extends window.StateListenerBase {
      override onStateChanged(nextState: WindowState): void {
        if (!disposed) {
          setState(nextState);
        }
      }
    }

    const listener = new ListenerImpl();

    void windowService
      .subscribeState(listener)
      .then((nextSubscription) => {
        if (disposed) {
          nextSubscription[Symbol.dispose]();
          return;
        }

        subscription = nextSubscription;
      })
      .catch(() => {
        if (!disposed) {
          setState(fallback);
        }
      });

    return () => {
      disposed = true;
      listener[Symbol.dispose]?.();
      if (subscription) {
        void subscription.unsubscribe().finally(() => {
          subscription?.[Symbol.dispose]();
        });
      }
    };
  }, [fallback]);

  return state;
}
