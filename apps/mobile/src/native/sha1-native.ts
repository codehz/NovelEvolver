import NativeSha1 from "./NativeSha1";
import { asBytes, sha1Hex, toBase64 } from "./sha1";

export function sha1Native(value: string | Uint8Array | ArrayBuffer): string {
  const bytes = asBytes(value);
  return NativeSha1?.sha1(toBase64(bytes)) ?? sha1Hex(bytes);
}
