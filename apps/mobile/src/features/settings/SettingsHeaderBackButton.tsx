import { HeaderBackButton, type HeaderBackButtonProps } from "@react-navigation/elements";

import { wash } from "../../shared/theme";
import { settingsStyles } from "./settings-chrome";

export function SettingsHeaderBackButton(props: HeaderBackButtonProps) {
  return (
    <HeaderBackButton
      {...props}
      pressColor={props.pressColor ?? wash.iconButton}
      style={[settingsStyles.headerBack, props.style]}
    />
  );
}
