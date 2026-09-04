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

function utf8SequenceLength(lead: number): number {
  if (lead <= 0x7f) return 1;
  if ((lead & 0xe0) === 0xc0) return 2;
  if ((lead & 0xf0) === 0xe0) return 3;
  if ((lead & 0xf8) === 0xf0) return 4;
  return 1;
}

function completeUtf8ByteLength(bytes: Uint8Array): number {
  const length = bytes.length;
  if (length === 0) return 0;
  const maxLookback = Math.min(3, length);
  for (let lookback = 1; lookback <= maxLookback; lookback += 1) {
    const start = length - lookback;
    const lead = bytes[start]!;
    if ((lead & 0xc0) === 0x80) continue;
    return utf8SequenceLength(lead) > lookback ? start : length;
  }
  return length;
}

function toBytes(input: ArrayBuffer | ArrayBufferView): Uint8Array {
  return input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length === 0) return right;
  if (right.length === 0) return left;
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

export class TextDecoder {
  readonly encoding: string;
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;
  #leftover = new Uint8Array(0);
  #seenBOM = false;

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
    const incoming = input == null ? new Uint8Array(0) : toBytes(input);
    const bytes = concatBytes(this.#leftover, incoming);
    const stream = options?.stream === true;
    const completeLength = stream ? completeUtf8ByteLength(bytes) : bytes.length;
    const complete = bytes.subarray(0, completeLength);
    this.#leftover = stream ? bytes.slice(completeLength) : new Uint8Array(0);

    if (this.fatal && !isValidUtf8(complete)) {
      throw new TypeError("Invalid UTF-8 sequence");
    }

    let start = 0;
    if (
      this.ignoreBOM &&
      !this.#seenBOM &&
      complete.length >= 3 &&
      complete[0] === 0xef &&
      complete[1] === 0xbb &&
      complete[2] === 0xbf
    ) {
      start = 3;
    }
    if (complete.length > 0) {
      this.#seenBOM = true;
    }
    return Buffer.from(complete.subarray(start)).toString("utf8");
  }
}

type RuntimeGlobal = {
  TextDecoder?: typeof TextDecoder;
};

const runtimeGlobal = globalThis as unknown as RuntimeGlobal;
if (typeof runtimeGlobal.TextDecoder !== "function") {
  runtimeGlobal.TextDecoder = TextDecoder;
}
