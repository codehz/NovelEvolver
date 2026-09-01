/** RFC 4122 UUID v4. Hermes has no Web Crypto; Math.random is enough for request ids. */
export function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type RuntimeGlobal = {
  crypto?: { randomUUID?: () => string };
};

const runtimeGlobal = globalThis as unknown as RuntimeGlobal;
if (runtimeGlobal.crypto == null) {
  runtimeGlobal.crypto = { randomUUID };
} else if (typeof runtimeGlobal.crypto.randomUUID !== "function") {
  runtimeGlobal.crypto.randomUUID = randomUUID;
}
