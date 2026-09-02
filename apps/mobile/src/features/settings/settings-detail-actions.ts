import { useEffect, useRef } from "react";

export type SettingsDetailActions = {
  save: () => void;
  remove?: () => void;
  resetToDefaults?: () => void;
  resetToDefaultsDisabled?: boolean;
};

export type SettingsDetailActionChange = (actions: SettingsDetailActions | null) => void;

export function useSettingsDetailActions(
  onActionsChange: SettingsDetailActionChange,
  actions: SettingsDetailActions,
) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    onActionsChange({
      save: () => actionsRef.current.save(),
      remove: actionsRef.current.remove ? () => actionsRef.current.remove?.() : undefined,
      resetToDefaults: actionsRef.current.resetToDefaults
        ? () => actionsRef.current.resetToDefaults?.()
        : undefined,
      resetToDefaultsDisabled: actionsRef.current.resetToDefaultsDisabled,
    });
    return () => onActionsChange(null);
  }, [onActionsChange, actions.resetToDefaults != null, actions.resetToDefaultsDisabled]);
}
