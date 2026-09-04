import type { HybridObject } from "react-native-nitro-modules";

export interface StreamFetchHeader {
  key: string;
  value: string;
}

export interface StreamFetchResponseInfo {
  url: string;
  status: number;
  statusText: string;
  headers: StreamFetchHeader[];
}

export interface StreamFetchRequest extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  start(): void;
  cancel(): void;
}

export interface StreamFetchBuilder extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  setMethod(httpMethod: string): void;
  addHeader(name: string, value: string): void;
  setBodyString(body: string): void;
  setBodyBytes(body: ArrayBuffer): void;
  onResponse(callback: (info: StreamFetchResponseInfo) => void): void;
  onChunk(callback: (bytes: ArrayBuffer) => void): void;
  onComplete(callback: () => void): void;
  onError(callback: (message: string) => void): void;
  build(): StreamFetchRequest;
}

export interface NativeStreamFetch extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  newBuilder(url: string): StreamFetchBuilder;
}
