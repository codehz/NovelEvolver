declare module "~icons/codicon/*" {
  import type { ComponentType } from "react";
  import type { SvgProps } from "react-native-svg";

  const Icon: ComponentType<SvgProps>;
  export default Icon;
}

declare module "@ungap/structured-clone" {
  const structuredClone: typeof globalThis.structuredClone;
  export default structuredClone;
}
