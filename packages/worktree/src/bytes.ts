const utf8Decoder = new TextDecoder("utf-8");
const utf8Encoder = new TextEncoder();

export function decodeUtf8(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

export function encodeUtf8(text: string): Uint8Array {
  return utf8Encoder.encode(text);
}

export function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).byteLength;
}
