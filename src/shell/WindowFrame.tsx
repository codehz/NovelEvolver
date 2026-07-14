import { AutoTransition } from "@codehz/auto-transition";
import { useAtomValue } from "jotai";
import { ForwardedRef, type ReactNode } from "react";
import { chromatic, type SlotOptions } from "slot-text";

import { windowService } from "#app/shared/lib/rpc/app-rpc";
import { useWindowState } from "#app/shared/lib/rpc/app-rpc-react";
import {
  StatusBarLeftPortalTarget,
  StatusBarRightPortalTarget,
} from "#app/shared/lib/shell/statusbar-portal";
import { TitleBarActionsPortalTarget } from "#app/shared/lib/shell/titlebar-portal";
import { titleBarTitleAtom } from "#app/shared/lib/shell/titlebar-title";
import { cn } from "#app/shared/lib/ui/cn";
import { SlotText } from "#app/shared/ui";
import { ContextMenuHost } from "#app/shell/context-menu";
import { NotificationBellButton, NotificationToastStack } from "#app/shell/notifications";
import { QuickPickHost } from "#app/shell/quick-pick";
import type { WindowState } from "#shared/window";

const windowControlButtonClass = cn(
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-titlebar-foreground transition-colors duration-150 hover:bg-ctp-text/8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background active:bg-ctp-text/8",
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
    <>
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
    </>
  );
}

const windowTitleSlotTextOptions: SlotOptions = {
  skipUnchanged: false,
  color: chromatic({ from: 190 }),
  direction: "down",
};

function WindowTitle() {
  const titleBarTitle = useAtomValue(titleBarTitleAtom);

  return (
    <p className="truncate text-xs font-medium text-titlebar-foreground">
      <SlotText text={titleBarTitle} options={windowTitleSlotTextOptions} />
    </p>
  );
}

const titlebarChromeTransitionClass = cn("transition-opacity duration-200 ease-out");

const fallbackWindowState: WindowState = {
  isFocused: true,
  isMaximized: false,
  platform: "unknown",
};

function TitleBar() {
  const windowState = useWindowState(fallbackWindowState);
  const isMac = windowState.platform === "darwin";
  const titlebarChromeOpacityClass = cn(windowState.isFocused ? "opacity-100" : "opacity-45");

  return (
    <header
      className={cn(
        "flex h-titlebar min-w-0 items-stretch justify-between pl-3 select-none app-region-drag",
        titlebarChromeTransitionClass,
        titlebarChromeOpacityClass,
      )}
    >
      <div className={cn("flex min-w-0 items-center gap-2 self-center", isMac && "pl-18")}>
        <div className="flex size-5 items-center justify-center rounded-sm bg-badge-background text-2xs font-semibold text-badge-foreground app-region-no-drag">
          NE
        </div>
        <WindowTitle />
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center self-stretch app-region-no-drag",
          isMac ? "pr-2" : "gap-1 px-1",
        )}
      >
        <TitleBarActionsPortalTarget as={Animatable} className="flex items-center" />
        {!isMac && (
          <WindowControls
            isMaximized={windowState.isMaximized}
            onMinimize={() => {
              void windowService.minimize();
            }}
            onToggleMaximize={() => {
              void windowService.toggleMaximize();
            }}
            onClose={() => {
              void windowService.close();
            }}
          />
        )}
      </div>
    </header>
  );
}

function StatusBar() {
  return (
    <footer className="relative flex h-5.5 shrink-0 items-stretch text-xs text-app-foreground">
      <StatusBarLeftPortalTarget
        as={Animatable}
        className="flex min-w-0 flex-1 items-stretch overflow-hidden"
      />
      <StatusBarRightPortalTarget as={Animatable} className="flex shrink-0 items-stretch" />
      <NotificationBellButton />
    </footer>
  );
}

export function WindowFrame({ children }: { children: ReactNode }) {
  return (
    <main className={cn("flex min-h-0 flex-1 flex-col bg-window-chrome text-app-foreground")}>
      <TitleBar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-app-background">{children}</div>
      <StatusBar />
      <NotificationToastStack />
      <QuickPickHost />
      <ContextMenuHost />
    </main>
  );
}

function Animatable({
  ref,
  className,
  ["data-foxact-magic-portal-target"]: target,
}: {
  ref: ForwardedRef<HTMLDivElement>;
  className?: string;
  "data-foxact-magic-portal-target"?: string;
}) {
  return (
    <AutoTransition patch>
      <div data-foxact-magic-portal-target={target} ref={ref} className={className} />
    </AutoTransition>
  );
}
