declare module "react-native" {
  export interface TurboModule {
    getConstants?: () => object;
  }

  export const TurboModuleRegistry: {
    get<T>(name: string): T | null;
    getEnforcing<T>(name: string): T;
  };
}
