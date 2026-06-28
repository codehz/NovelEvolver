import { useEffect, useState, type ReactNode } from "react";

import type { WindowState } from "../../shared/window";
import { cn } from "../lib/cn";
import { WindowControls } from "./WindowControls";

const fallbackWindowState: WindowState = {
  isMaximized: false,
  platform: "unknown",
};

export function WindowFrame({ children }: { children: ReactNode }) {
  const [windowState, setWindowState] = useState<WindowState>(fallbackWindowState);

  useEffect(() => {
    window
      .invokeIpc("window:get-state")
      .then(setWindowState)
      .catch(() => {
        setWindowState(fallbackWindowState);
      });

    const disposeWindowStateListener = window.onIpcEvent("window:state-changed", (state) => {
      setWindowState(state);
    });

    return () => {
      disposeWindowStateListener();
    };
  }, []);

  const isMac = windowState.platform === "darwin";

  return (
    <main className="flex min-h-screen flex-col bg-app-background font-app text-app-foreground">
      <header className="flex h-titlebar items-stretch justify-between border-b border-titlebar-border bg-titlebar-background pl-3 select-none app-region-drag">
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 self-center",
            isMac && "pl-mac-traffic-light-offset",
          )}
        >
          <div className="flex size-5 items-center justify-center rounded-sm bg-badge-background text-badge font-semibold text-badge-foreground app-region-no-drag">
            NE
          </div>
          <p className="truncate text-titlebar font-medium text-titlebar-foreground">
            NovelEvolver
          </p>
        </div>

        {isMac ? null : (
          <WindowControls
            isMaximized={windowState.isMaximized}
            onMinimize={() => {
              void window.invokeIpc("window:minimize");
            }}
            onToggleMaximize={() => {
              void window.invokeIpc("window:toggle-maximize").then(setWindowState);
            }}
            onClose={() => {
              void window.invokeIpc("window:close");
            }}
          />
        )}
      </header>

      <section className="flex-1 bg-app-background">{children}</section>
    </main>
  );
}
