import { useCallback, useState } from "react";

import {
  DEFAULT_AUXILIARY_WIDTH,
  DEFAULT_PRIMARY_WIDTH,
  type LayoutPreferences,
} from "../resolve/workbench-layout-resolver";

export function useWorkbenchLayoutPreferences() {
  const [layoutPreferences, setLayoutPreferences] = useState<LayoutPreferences>({
    primaryVisible: true,
    primaryWidth: DEFAULT_PRIMARY_WIDTH,
    auxiliaryVisible: true,
    auxiliaryWidth: DEFAULT_AUXILIARY_WIDTH,
    priority: "primary",
  });

  const togglePrimarySidebar = useCallback((primaryVisible: boolean) => {
    setLayoutPreferences((value) => ({
      ...value,
      primaryVisible: !primaryVisible,
      priority: "primary",
    }));
  }, []);

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
    togglePrimarySidebar,
    toggleAuxiliarySidebar,
  };
}
