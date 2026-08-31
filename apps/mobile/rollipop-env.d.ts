/// <reference types="rollipop/client" />

declare module "~icons/*" {
  import type { ComponentType } from "react";
  import type { SvgProps } from "react-native-svg";

  const Icon: ComponentType<SvgProps>;
  export default Icon;
}
