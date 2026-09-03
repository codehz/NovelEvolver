import { Buffer } from "buffer";

function isValidUtf8(bytes: Uint8Array): boolean {
  let index = 0;
  while (index < bytes.length) {
    const byte = bytes[index]!;
    if (byte <= 0x7f) {
      index += 1;
      continue;
    }
    if ((byte & 0xe0) === 0xc0) {
      if (index + 1 >= bytes.length || (bytes[index + 1]! & 0xc0) !== 0x80) return false;
      if (byte < 0xc2) return false;
      index += 2;
      continue;
    }
    if ((byte & 0xf0) === 0xe0) {
      if (
        index + 2 >= bytes.length ||
        (bytes[index + 1]! & 0xc0) !== 0x80 ||
        (bytes[index + 2]! & 0xc0) !== 0x80
      ) {
        return false;
      }
      index += 3;
      continue;
    }
    if ((byte & 0xf8) === 0xf0) {
      if (
        index + 3 >= bytes.length ||
        (bytes[index + 1]! & 0xc0) !== 0x80 ||
        (bytes[index + 2]! & 0xc0) !== 0x80 ||
        (bytes[index + 3]! & 0xc0) !== 0x80
      ) {
        return false;
      }
      if (byte > 0xf4 || (byte === 0xf4 && (bytes[index + 1]! & 0xff) > 0x8f)) return false;
      index += 4;
      continue;
    }
    return false;
  }
  return true;
}

export class TextDecoder {
  readonly encoding: string;
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;

  constructor(label = "utf-8", options: { fatal?: boolean; ignoreBOM?: boolean } = {}) {
    const normalized = label.trim().toLowerCase().replace(/[-_]/g, "");
    if (normalized !== "utf8") {
      throw new RangeError(`Unsupported encoding: ${label}`);
    }
    this.encoding = "utf-8";
    this.fatal = options.fatal ?? false;
    this.ignoreBOM = options.ignoreBOM ?? false;
  }

  decode(input?: ArrayBuffer | ArrayBufferView | null, options?: { stream?: boolean }): string {
    if (options?.stream) {
      throw new TypeError("Streaming decode is not supported");
    }
    if (input == null) return "";
    const bytes =
      input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    let start = 0;
    if (
      this.ignoreBOM &&
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      start = 3;
    }
    const slice = bytes.subarray(start);
    if (this.fatal && !isValidUtf8(slice)) {
      throw new TypeError("Invalid UTF-8 sequence");
    }
    return Buffer.from(slice).toString("utf8");
  }
}

type RuntimeGlobal = {
  TextDecoder?: typeof TextDecoder;
};

const runtimeGlobal = globalThis as unknown as RuntimeGlobal;
if (typeof runtimeGlobal.TextDecoder !== "function") {
  runtimeGlobal.TextDecoder = TextDecoder;
}
