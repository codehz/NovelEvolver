import { useRef } from "react";

import { useAnimatedContentHeight } from "#app/lib/animated-height";

import {
  quickPickPanelClass,
  quickPickPanelContentClass,
  quickPickPanelHeightShellClass,
} from "./quick-pick-chrome";
import {
  QuickPickPopoverContent,
  QuickPickPopoverProvider,
  QuickPickPopoverTarget,
} from "./quick-pick-popover";

export function QuickPickOverlay({
  titleId,
  onDismiss,
  children,
}: {
  titleId: string;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { heightPx: shellHeightPx } = useAnimatedContentHeight(contentRef, panelRef);

  return (
    <QuickPickPopoverProvider onDismiss={onDismiss}>
      <QuickPickPopoverTarget
        ref={panelRef}
        aria-labelledby={titleId}
        className={quickPickPanelClass}
        role="dialog"
      >
        <div
          className={quickPickPanelHeightShellClass}
          style={shellHeightPx != null ? { height: shellHeightPx } : undefined}
        >
          <div ref={contentRef} className={quickPickPanelContentClass}>
            <QuickPickPopoverContent>{children}</QuickPickPopoverContent>
          </div>
        </div>
      </QuickPickPopoverTarget>
    </QuickPickPopoverProvider>
  );
}
