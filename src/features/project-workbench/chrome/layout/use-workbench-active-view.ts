import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { WorkbenchPrimaryView } from "../types";
import type { LayoutPreferences } from "./workbench-layout-resolver";

function requirePrimaryViews(primaryViews: readonly WorkbenchPrimaryView[]) {
  if (primaryViews.length === 0) {
    throw new Error("WorkbenchLayout requires at least one primary view");
  }
}

function resolveDefaultActiveViewId(
  primaryViews: readonly WorkbenchPrimaryView[],
  defaultActiveViewId?: string,
) {
  requirePrimaryViews(primaryViews);

  if (defaultActiveViewId) {
    const matchedView = primaryViews.find((view) => view.id === defaultActiveViewId);
    if (matchedView) {
      return matchedView.id;
    }
  }

  return primaryViews[0]!.id;
}

export function useWorkbenchActiveView({
  defaultActiveViewId,
  primaryViews,
  setLayoutPreferences,
}: {
  defaultActiveViewId?: string;
  primaryViews: readonly WorkbenchPrimaryView[];
  setLayoutPreferences: Dispatch<SetStateAction<LayoutPreferences>>;
}) {
  requirePrimaryViews(primaryViews);

  const [activeViewId, setActiveViewId] = useState(() =>
    resolveDefaultActiveViewId(primaryViews, defaultActiveViewId),
  );

  useEffect(() => {
    const nextActiveViewId = primaryViews.some((view) => view.id === activeViewId)
      ? activeViewId
      : resolveDefaultActiveViewId(primaryViews, defaultActiveViewId);

    if (nextActiveViewId !== activeViewId) {
      setActiveViewId(nextActiveViewId);
    }
  }, [activeViewId, defaultActiveViewId, primaryViews]);

  const activePrimaryView = useMemo(() => {
    const matchedView = primaryViews.find((view) => view.id === activeViewId);
    return matchedView ?? primaryViews[0]!;
  }, [activeViewId, primaryViews]);

  const handleSelectView = useCallback(
    (viewId: string, primarySidebarVisible: boolean) => {
      if (viewId === activeViewId && primarySidebarVisible) {
        setLayoutPreferences((value) => ({
          ...value,
          primaryVisible: false,
        }));
        return;
      }

      setActiveViewId(viewId);
      setLayoutPreferences((value) => ({
        ...value,
        primaryVisible: true,
        priority: "primary",
      }));
    },
    [activeViewId, setLayoutPreferences],
  );

  const handlePrimarySidebarToggle = useCallback(
    (primarySidebarVisible: boolean) => {
      setLayoutPreferences((value) => ({
        ...value,
        primaryVisible: !primarySidebarVisible,
        priority: "primary",
      }));
    },
    [setLayoutPreferences],
  );

  return {
    activePrimaryView,
    activeViewId,
    handlePrimarySidebarToggle,
    handleSelectView,
  };
}
