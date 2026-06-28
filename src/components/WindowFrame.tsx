import { useEffect, useState, type ReactNode } from "react";

import type { WindowState } from "../../shared/window";
import { cn } from "../lib/cn";
import { TitleBarPortalTarget } from "../lib/titlebar-portal";

const windowControlButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-titlebar-foreground transition-colors duration-150 hover:bg-window-button-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background active:bg-window-button-hover",
);

function WindowControls({
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose,
}: {
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 self-stretch px-1 app-region-no-drag">
      <button
        aria-label="Minimize window"
        className={cn(windowControlButtonClass)}
        type="button"
        onClick={onMinimize}
      >
        <span aria-hidden="true" className="icon-[codicon--chrome-minimize] text-sm" />
      </button>
      <button
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        className={cn(windowControlButtonClass)}
        type="button"
        onClick={onToggleMaximize}
      >
        <span
          aria-hidden="true"
          className={cn(
            "text-sm",
            isMaximized ? "icon-[codicon--chrome-restore]" : "icon-[codicon--chrome-maximize]",
          )}
        />
      </button>
      <button
        aria-label="Close window"
        className={cn(
          windowControlButtonClass,
          "hover:bg-window-button-close-hover hover:text-badge-foreground active:bg-window-button-close-hover active:text-badge-foreground",
        )}
        type="button"
        onClick={onClose}
      >
        <span aria-hidden="true" className="icon-[codicon--close] text-sm" />
      </button>
    </div>
  );
}

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
    <main className="flex min-h-0 flex-1 flex-col bg-app-background text-app-foreground">
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
          <TitleBarPortalTarget
            as="p"
            className="truncate text-titlebar font-medium text-titlebar-foreground"
          />
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

      <section className="flex min-h-0 flex-1 flex-col bg-app-background">{children}</section>
    </main>
  );
}
