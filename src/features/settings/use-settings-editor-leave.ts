import { useEffect, useRef, type RefObject } from "react";

import {
  createSettingsLeaveGuard,
  requestSettingsLeave,
  setActiveSettingsLeaveGuard,
  type SettingsFormHandle,
} from "./settings-leave-guard";

type UseSettingsEditorLeaveOptions = {
  editorOpen: boolean;
  busy: boolean;
  dirty: boolean;
  formRef: RefObject<SettingsFormHandle | null>;
  closeEditor: () => void;
};

/**
 * Registers a leave guard while a settings subpage editor is open,
 * and returns requestClose for back / cancel actions.
 */
export function useSettingsEditorLeave({
  editorOpen,
  busy,
  dirty,
  formRef,
  closeEditor,
}: UseSettingsEditorLeaveOptions): {
  requestClose: () => Promise<void>;
} {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    // Only the open editor registers a guard. Closed panels must not clear another tab's guard.
    if (!editorOpen) {
      return;
    }

    setActiveSettingsLeaveGuard(
      createSettingsLeaveGuard({
        isDirty: () => dirtyRef.current,
        isBusy: () => busyRef.current,
        save: async () => (await formRef.current?.save()) ?? false,
      }),
    );

    return () => {
      setActiveSettingsLeaveGuard(null);
    };
  }, [editorOpen, formRef]);

  return {
    requestClose: async () => {
      const ok = await requestSettingsLeave();
      if (ok) {
        closeEditor();
      }
    },
  };
}
