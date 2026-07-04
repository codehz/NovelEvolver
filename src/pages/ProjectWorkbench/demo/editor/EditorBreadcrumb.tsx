import { AutoTransition, effects, preset } from "@codehz/auto-transition";
import { Fragment } from "react";

import { cn } from "#app/lib/cn";

import type { WorkbenchEditorTab } from "../state/types";
import { useEditorBreadcrumb } from "./use-editor-breadcrumb";

const breadcrumbButtonClass = cn("max-w-48 truncate rounded px-1 py-0.5 text-xs");
const breadcrumbCurrentButtonClass = cn("text-app-foreground");
const breadcrumbClickableButtonClass = cn(
  "text-ctp-subtext0 hover:bg-ctp-text/8 hover:text-app-foreground",
);
const breadcrumbCurrentTextClass = cn("max-w-48 truncate text-xs text-app-foreground");

export function EditorBreadcrumb({ tab }: { tab: WorkbenchEditorTab }) {
  const { ariaLabel, segments } = useEditorBreadcrumb(tab);

  if (segments.length === 0) {
    return null;
  }

  return (
    <AutoTransition
      as="nav"
      aria-label={ariaLabel}
      className="flex min-w-0 items-center gap-1"
      transition={breadcrumbTransitionPreset}
    >
      {segments.map((segment, index) => (
        <Fragment key={segment.key}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0"
            />
          ) : null}
          {segment.clickable ? (
            <button
              className={cn(
                breadcrumbButtonClass,
                segment.current ? breadcrumbCurrentButtonClass : breadcrumbClickableButtonClass,
              )}
              type="button"
              onClick={segment.onClick}
            >
              {segment.label}
            </button>
          ) : (
            <span className={breadcrumbCurrentTextClass}>{segment.label}</span>
          )}
        </Fragment>
      ))}
    </AutoTransition>
  );
}

const breadcrumbEase = "cubic-bezier(0.22, 1, 0.36, 1)";

const breadcrumbTransitionPreset = preset({
  enter: [effects.fade(0), effects.translate({ x: 8, y: 0 })],
  exit: [effects.fade(0), effects.translate({ x: -8, y: 0 })],
  move: effects.flip(),
  timing: {
    enter: { duration: 220, easing: breadcrumbEase },
    exit: { duration: 180, easing: breadcrumbEase },
    move: { duration: 320, easing: breadcrumbEase },
  },
});
