/// <reference types="rollipop/client" />

declare module "~icons/*" {
  import type { ComponentType } from "react";
  import type { SvgProps } from "react-native-svg";

  const Icon: ComponentType<SvgProps>;
  export default Icon;
}

declare module "@ungap/structured-clone" {
  type StructuredCloneOptions = {
    transfer?: unknown[];
    json?: boolean;
    lossy?: boolean;
  };

  export default function structuredClone<T>(value: T, options?: StructuredCloneOptions): T;
}
