import structuredClonePolyfill from "@ungap/structured-clone";

type RuntimeGlobal = typeof globalThis & {
  structuredClone?: typeof structuredClonePolyfill;
};

const runtimeGlobal = globalThis as RuntimeGlobal;
if (runtimeGlobal.structuredClone === undefined) {
  runtimeGlobal.structuredClone = structuredClonePolyfill;
}
