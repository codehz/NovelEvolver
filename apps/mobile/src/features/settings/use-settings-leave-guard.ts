import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useEffect, type ReactNode } from "react";
import { BackHandler } from "react-native";

import { useConfirm } from "../../shared/ui/OverlayHost";
import {
  beginSettingsEditor,
  requestSettingsLeave,
  setSettingsLeaveConfirm,
  useSettingsDirty,
} from "./settings-leave-guard";

type SettingsLeaveBinderProps = {
  children: ReactNode;
};

export function SettingsLeaveBinder({ children }: SettingsLeaveBinderProps): ReactNode {
  const confirm = useConfirm();

  useEffect(() => {
    setSettingsLeaveConfirm(() => confirm());
    return () => {
      setSettingsLeaveConfirm(null);
    };
  }, [confirm]);

  return children;
}

type UseSettingsLeaveGuardOptions = {
  editor?: boolean;
};

export function useSettingsLeaveGuard(options?: UseSettingsLeaveGuardOptions): void {
  const navigation = useNavigation();
  const dirty = useSettingsDirty();
  const editor = options?.editor ?? false;

  usePreventRemove(dirty, ({ data }) => {
    void requestSettingsLeave().then((ok) => {
      if (ok) {
        navigation.dispatch(data.action);
      }
    });
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    return beginSettingsEditor();
  }, [editor]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const stackCanPop = (navigation.getState()?.index ?? 0) > 0;
    if (stackCanPop) {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      void requestSettingsLeave().then((ok) => {
        if (ok) {
          navigation.goBack();
        }
      });
      return true;
    });
    return () => {
      subscription.remove();
    };
  }, [dirty, navigation]);
}
