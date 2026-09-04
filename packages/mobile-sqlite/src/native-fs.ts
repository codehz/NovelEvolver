import { NitroModules } from "react-native-nitro-modules";

import type { NativeFs } from "./NativeFs.nitro";

let nativeFs: NativeFs | undefined;

export function getNativeFs(): NativeFs {
  nativeFs ??= NitroModules.createHybridObject<NativeFs>("NativeFs");
  return nativeFs;
}
