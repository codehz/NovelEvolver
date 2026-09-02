import { HeaderBackButton, type HeaderBackButtonProps } from "@react-navigation/elements";
import IconChevronLeft from "~icons/codicon/chevron-left";

import { wash } from "../../shared/theme";
import { settingsStyles } from "./settings-chrome";

export function SettingsHeaderBackButton(props: HeaderBackButtonProps) {
  const backImage: NonNullable<HeaderBackButtonProps["backImage"]> = ({ tintColor }) => (
    <IconChevronLeft width={24} height={24} color={tintColor} />
  );

  return (
    <HeaderBackButton
      {...props}
      backImage={props.backImage ?? backImage}
      pressColor={props.pressColor ?? wash.iconButton}
      style={[settingsStyles.headerBack, props.style]}
    />
  );
}
