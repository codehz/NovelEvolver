import { TurboModuleRegistry, type TurboModule } from "react-native";

export interface Spec extends TurboModule {
  open(name: string, location: string, readonly: boolean): number;
  execute(connectionId: number, sql: string, paramsJson: string): string;
  close(connectionId: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>("NativeSqlite");
