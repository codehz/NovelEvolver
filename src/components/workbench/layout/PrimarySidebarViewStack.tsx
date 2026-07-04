import { cn } from "#app/lib/cn";

import type { WorkbenchPrimaryView } from "../types";

const primarySidebarViewPaneClass = cn(
  "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-1 flex-col",
  "transition-opacity duration-150",
);

const primarySidebarViewStackClass = cn(
  "grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)]",
);

export function PrimarySidebarViewStack({
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
            aria-label={view.title}
            className={cn(
              primarySidebarViewPaneClass,
              isActive
                ? "pointer-events-auto z-10 opacity-100"
                : "pointer-events-none z-0 opacity-0",
            )}
          >
            {view.content}
          </section>
        );
      })}
    </div>
  );
}
