import { useRef } from "react";

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
import { useQuickPickPanelHeightAnimation } from "./use-quick-pick-panel-height-animation";

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
  const { shellHeightPx } = useQuickPickPanelHeightAnimation(contentRef, panelRef);

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
