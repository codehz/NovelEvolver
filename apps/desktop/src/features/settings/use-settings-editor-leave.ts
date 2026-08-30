import { useEffect, useRef, type RefObject } from "react";

import {
  createSettingsLeaveGuard,
  requestSettingsLeave,
  setActiveSettingsLeaveGuard,
  type SettingsFormHandle,
} from "./settings-leave-guard";

type UseSettingsEditorLeaveOptions = {
  /** Whether this panel's tab is the active settings category. */
  active?: boolean;
  /** Whether an editor form is currently mounted / selected. */
  editorOpen: boolean;
  busy: boolean;
  dirty: boolean;
  formRef: RefObject<SettingsFormHandle | null>;
  /** Called after leave is allowed (back / close editor). */
  closeEditor: () => void;
  /**
   * Called when the user discards unsaved changes via the leave dialog.
   * Use to remount the form / clear dirty without necessarily closing the editor.
   */
  onDiscard?: () => void;
};

/**
 * Registers a leave guard while this panel is the active tab and an editor is open.
 * Returns requestClose for back / selection-change actions.
 */
export function useSettingsEditorLeave({
  active = true,
  editorOpen,
  busy,
  dirty,
  formRef,
  closeEditor,
  onDiscard,
}: UseSettingsEditorLeaveOptions): {
  requestClose: () => Promise<void>;
  /** Ask leave guard; resolves true when navigation may proceed. */
  requestLeave: () => Promise<boolean>;
} {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;

  useEffect(() => {
    // Only the active tab's open editor registers a guard.
    // Inactive keep-alive panels must not clear another tab's guard.
    if (!active || !editorOpen) {
      return;
    }

    setActiveSettingsLeaveGuard(
      createSettingsLeaveGuard({
        isDirty: () => dirtyRef.current,
        isBusy: () => busyRef.current,
        save: async () => (await formRef.current?.save()) ?? false,
        onDiscard: () => {
          onDiscardRef.current?.();
        },
      }),
    );

    return () => {
      setActiveSettingsLeaveGuard(null);
    };
  }, [active, editorOpen, formRef]);

  const requestLeave = async () => requestSettingsLeave();

  return {
    requestLeave,
    requestClose: async () => {
      const ok = await requestLeave();
      if (ok) {
        closeEditor();
      }
    },
  };
}
