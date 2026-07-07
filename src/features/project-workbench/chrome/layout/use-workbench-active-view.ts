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

function resolveDefaultActiveViewId(
  primaryViews: readonly WorkbenchPrimaryView[],
  defaultActiveViewId?: string,
) {
  if (primaryViews.length === 0) {
    return null;
  }

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
  const [activeViewId, setActiveViewId] = useState<string | null>(() =>
    resolveDefaultActiveViewId(primaryViews, defaultActiveViewId),
  );

  useEffect(() => {
    const nextActiveViewId =
      activeViewId != null && primaryViews.some((view) => view.id === activeViewId)
        ? activeViewId
        : resolveDefaultActiveViewId(primaryViews, defaultActiveViewId);

    if (nextActiveViewId !== activeViewId) {
      setActiveViewId(nextActiveViewId);
    }
  }, [activeViewId, defaultActiveViewId, primaryViews]);

  const activePrimaryView = useMemo(
    () => primaryViews.find((view) => view.id === activeViewId) ?? null,
    [activeViewId, primaryViews],
  );

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
      if (primaryViews.length === 0) {
        return;
      }

      setActiveViewId(
        (value) => value ?? resolveDefaultActiveViewId(primaryViews, defaultActiveViewId),
      );
      setLayoutPreferences((value) => ({
        ...value,
        primaryVisible: !primarySidebarVisible,
        priority: "primary",
      }));
    },
    [defaultActiveViewId, primaryViews, setLayoutPreferences],
  );

  return {
    activePrimaryView,
    activeViewId,
    handlePrimarySidebarToggle,
    handleSelectView,
  };
}
