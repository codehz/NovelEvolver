import { TurboModuleRegistry, type TurboModule } from "react-native";

export interface Spec extends TurboModule {
  sha1(base64: string): string;
}

export default TurboModuleRegistry.get<Spec>("NativeSha1");
