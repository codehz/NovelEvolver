import { HeaderBackButton, type HeaderBackButtonProps } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import { requestSettingsLeave } from "./settings-leave-guard";

export function SettingsListHeaderLeft(props: HeaderBackButtonProps) {
  const navigation = useNavigation();
  return (
    <HeaderBackButton
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
