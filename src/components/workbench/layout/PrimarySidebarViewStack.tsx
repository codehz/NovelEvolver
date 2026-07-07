import { memo } from "react";

import { cn } from "#app/lib/cn";

import type { WorkbenchPrimaryView } from "../types";
import { PrimarySidebar } from "./PrimarySidebar";

const primarySidebarViewPaneClass = cn(
  "col-start-1 row-start-1 flex size-full min-h-0 min-w-0 flex-col",
  "transition-opacity duration-150",
);

const primarySidebarViewStackClass = cn(
  "grid size-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)]",
);

export const PrimarySidebarViewStack = memo(function PrimarySidebarViewStack({
  views,
  activeViewId,
}: {
  views: readonly WorkbenchPrimaryView[];
  activeViewId: string | null;
}) {
  return (
    <div className={primarySidebarViewStackClass}>
      {views.map((view) => {
        const isActive = activeViewId === view.id;
        return (
          <section
            key={view.id}
            aria-hidden={!isActive}
            className={cn(
              primarySidebarViewPaneClass,
              isActive
                ? "pointer-events-auto z-10 opacity-100"
                : "pointer-events-none z-0 opacity-0",
            )}
          >
            <PrimarySidebar aria-hidden={!isActive} className="h-full min-h-0" title={view.title}>
              {view.content}
            </PrimarySidebar>
          </section>
        );
      })}
    </div>
  );
});
