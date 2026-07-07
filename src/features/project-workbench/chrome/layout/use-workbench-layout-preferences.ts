import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_AUXILIARY_WIDTH,
  DEFAULT_PRIMARY_WIDTH,
  type LayoutPreferences,
} from "./workbench-layout-resolver";

export function useWorkbenchLayoutPreferences({
  hasAuxiliary,
  hasPrimaryViews,
}: {
  hasAuxiliary: boolean;
  hasPrimaryViews: boolean;
}) {
  const [layoutPreferences, setLayoutPreferences] = useState<LayoutPreferences>({
    primaryVisible: hasPrimaryViews,
    primaryWidth: DEFAULT_PRIMARY_WIDTH,
    auxiliaryVisible: hasAuxiliary,
    auxiliaryWidth: DEFAULT_AUXILIARY_WIDTH,
    priority: "primary",
  });

  useEffect(() => {
    if (hasAuxiliary) {
      return;
    }

    setLayoutPreferences((value) =>
      value.auxiliaryVisible
        ? {
            ...value,
            auxiliaryVisible: false,
          }
        : value,
    );
  }, [hasAuxiliary]);

  useEffect(() => {
    if (hasPrimaryViews) {
      return;
    }

    setLayoutPreferences((value) =>
      value.primaryVisible
        ? {
            ...value,
            primaryVisible: false,
          }
        : value,
    );
  }, [hasPrimaryViews]);

  const toggleAuxiliarySidebar = useCallback((auxiliaryVisible: boolean) => {
    setLayoutPreferences((value) => ({
      ...value,
      auxiliaryVisible: !auxiliaryVisible,
      priority: "auxiliary",
    }));
  }, []);

  return {
    layoutPreferences,
    setLayoutPreferences,
    toggleAuxiliarySidebar,
  };
}
