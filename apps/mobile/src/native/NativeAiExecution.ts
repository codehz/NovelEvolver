import { TurboModuleRegistry, type TurboModule } from "react-native";

export interface Spec extends TurboModule {
  start(): void;
  stop(): void;
}

export const nativeAiExecution = TurboModuleRegistry.get<Spec>("NativeAiExecution");
