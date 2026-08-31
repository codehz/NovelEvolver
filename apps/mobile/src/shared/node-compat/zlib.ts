import { deflate, Inflate } from "pako";

import { asBytes } from "../../native/sha1";

type ZlibOptions = {
  info?: boolean;
  raw?: boolean;
  windowBits?: number;
};

type InflateState = {
  strm: {
    next_in: number;
  };
};

type InflateInfo = {
  buffer: Uint8Array;
  engine: {
    bytesWritten: number;
  };
};

function inflateError(inflator: Inflate): never {
  throw new Error(inflator.msg || `inflate failed with code ${inflator.err}`);
}

export function deflateSync(
  data: string | Uint8Array | ArrayBuffer,
  options?: ZlibOptions,
): Buffer {
  return Buffer.from(deflate(asBytes(data), options));
}

export function inflateSync(
  data: string | Uint8Array | ArrayBuffer,
  options?: ZlibOptions,
): Buffer | InflateInfo {
  const inflator = new Inflate(options);
  if (!inflator.push(asBytes(data), true)) inflateError(inflator);
  if (inflator.err !== 0 || !(inflator.result instanceof Uint8Array)) inflateError(inflator);

  const state = inflator as unknown as InflateState;
  const result = {
    buffer: Buffer.from(inflator.result),
    engine: { bytesWritten: state.strm.next_in },
  };
  return options?.info === true ? result : result.buffer;
}

const zlibStub = { deflateSync, inflateSync };
export default zlibStub;
