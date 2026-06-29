import { useEffect, useState } from "react";

import type { WindowState } from "@shared/window";
import { getProjectsService, getWindowService } from "./app-rpc";

export function useWindowService() {
  const [service, setService] = useState<Awaited<ReturnType<typeof getWindowService>> | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getWindowService().then((nextService) => {
      if (!cancelled) {
        setService(nextService);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return service;
}

export function useProjectsService() {
  const [service, setService] = useState<Awaited<ReturnType<typeof getProjectsService>> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void getProjectsService().then((nextService) => {
      if (!cancelled) {
        setService(nextService);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return service;
}

export function useWindowState(fallback: WindowState): WindowState {
  const windowService = useWindowService();
  const [state, setState] = useState<WindowState>(fallback);

  useEffect(() => {
    if (!windowService) {
      return;
    }

    let disposed = false;
    let subscription: Awaited<
      ReturnType<NonNullable<typeof windowService>["subscribeState"]>
    > | null = null;

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
  }, [fallback, windowService]);

  return state;
}
