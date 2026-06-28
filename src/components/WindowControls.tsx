import { cn } from "../lib/cn";

const windowControlButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-titlebar-foreground transition-colors duration-150 hover:bg-window-button-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background active:bg-window-button-hover",
);

export function WindowControls({
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