import { HeaderBackButton, type HeaderBackButtonProps } from "@react-navigation/elements";
import IconChevronLeft from "~icons/codicon/chevron-left";
import IconClose from "~icons/codicon/close";

import { wash } from "../../shared/theme";
import { settingsStyles } from "./settings-chrome";

type SettingsHeaderBackButtonProps = HeaderBackButtonProps & {
  icon?: "back" | "close";
};

export function SettingsHeaderBackButton({
  icon = "back",
  ...props
}: SettingsHeaderBackButtonProps) {
  const backImage: NonNullable<HeaderBackButtonProps["backImage"]> = ({ tintColor }) =>
    icon === "close" ? (
      <IconClose width={20} height={20} color={tintColor} />
    ) : (
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
