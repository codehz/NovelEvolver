import type { HeaderBackButtonProps } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import { requestSettingsLeave } from "./settings-leave-guard";
import { SettingsHeaderBackButton } from "./SettingsHeaderBackButton";

export function SettingsListHeaderLeft(props: HeaderBackButtonProps) {
  const navigation = useNavigation();
  return (
    <SettingsHeaderBackButton
      {...props}
      onPress={() => {
        void requestSettingsLeave().then((ok) => {
          if (ok) {
            navigation.goBack();
          }
        });
      }}
    />
  );
}
