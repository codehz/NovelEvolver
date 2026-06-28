import { useEffect, useState } from "react";

type WindowState = {
  isMaximized: boolean;
  platform: string;
};

const fallbackWindowState: WindowState = {
  isMaximized: false,
  platform: "unknown",
};

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
    <div className="flex items-center self-stretch app-region-no-drag">
      <button
        aria-label="Minimize window"
        className="inline-flex w-titlebar-button items-center justify-center border-0 bg-transparent text-vscode-titlebar-foreground transition-colors duration-150 hover:bg-vscode-window-button-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-vscode-badge-background"
        type="button"
        onClick={onMinimize}
      >
        <span className="-translate-y-px text-lg leading-none">-</span>
      </button>
      <button
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        className="inline-flex w-titlebar-button items-center justify-center border-0 bg-transparent text-vscode-titlebar-foreground transition-colors duration-150 hover:bg-vscode-window-button-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-vscode-badge-background"
        type="button"
        onClick={onToggleMaximize}
      >
        <span className="-translate-y-px text-sm leading-none">{isMaximized ? "❐" : "□"}</span>
      </button>
      <button
        aria-label="Close window"
        className="inline-flex w-titlebar-button items-center justify-center border-0 bg-transparent text-vscode-titlebar-foreground transition-colors duration-150 hover:bg-vscode-window-button-close-hover hover:text-vscode-badge-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-vscode-badge-background"
        type="button"
        onClick={onClose}
      >
        <span className="-translate-y-px text-sm leading-none">×</span>
      </button>
    </div>
  );
}

export default function App() {
  const [windowState, setWindowState] = useState<WindowState>(fallbackWindowState);

  useEffect(() => {
    window.electronAPI
      .getWindowState()
      .then(setWindowState)
      .catch(() => {
        setWindowState(fallbackWindowState);
      });

    const disposeWindowStateListener = window.electronAPI.onWindowStateChange((state) => {
      setWindowState(state);
    });

    return () => {
      disposeWindowStateListener();
    };
  }, []);

  const isMac = windowState.platform === "darwin";

  return (
    <main className="flex min-h-screen flex-col bg-vscode-editor-background font-vscode text-vscode-foreground">
      <header className="flex h-titlebar items-center justify-between border-b border-vscode-titlebar-border bg-vscode-titlebar-background pl-3 select-none app-region-drag">
        <div className={`flex min-w-0 items-center gap-2 ${isMac ? "pl-mac-traffic-light-offset" : ""}`}>
          <div className="flex size-5 items-center justify-center rounded-sm bg-vscode-badge-background text-vscode-badge font-semibold text-vscode-badge-foreground app-region-no-drag">
            NE
          </div>
          <p className="truncate text-vscode-titlebar font-medium text-vscode-titlebar-foreground">
            NovelEvolver
          </p>
        </div>

        {isMac ? null : (
          <WindowControls
            isMaximized={windowState.isMaximized}
            onMinimize={() => {
              void window.electronAPI.minimizeWindow();
            }}
            onToggleMaximize={() => {
              void window.electronAPI.toggleMaximizeWindow().then(setWindowState);
            }}
            onClose={() => {
              void window.electronAPI.closeWindow();
            }}
          />
        )}
      </header>

      <section className="flex-1 bg-vscode-editor-background">
        <div className="size-full" />
      </section>
    </main>
  );
}
