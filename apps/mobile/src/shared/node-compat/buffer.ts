import { Buffer } from "buffer";

// React Native does not expose Node's Buffer global. nano-git uses it while
// initializing some parsers, before any repository operation is called.
type RuntimeGlobal = typeof globalThis & { Buffer?: typeof Buffer };

const runtimeGlobal = globalThis as RuntimeGlobal;
if (runtimeGlobal.Buffer === undefined) {
  runtimeGlobal.Buffer = Buffer;
}
