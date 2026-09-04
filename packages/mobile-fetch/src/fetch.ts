import { NitroModules } from "react-native-nitro-modules";

import { createAbortError } from "./abort-error";
import { createByteStream } from "./byte-stream";
import { iterateHeadersInit } from "./headers";
import type { NativeStreamFetch, StreamFetchRequest } from "./NativeStreamFetch.nitro";
import { StreamResponse } from "./response";

let nativeFetch: NativeStreamFetch | undefined;

function getNativeFetch(): NativeStreamFetch {
  nativeFetch ??= NitroModules.createHybridObject<NativeStreamFetch>("NativeStreamFetch");
  return nativeFetch;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  throw new TypeError("Invalid fetch input");
}

function encodeBody(body: BodyInit | null | undefined): { string?: string; bytes?: ArrayBuffer } {
  if (body == null) return {};
  if (typeof body === "string") return { string: body };
  if (body instanceof ArrayBuffer) return { bytes: body };
  if (ArrayBuffer.isView(body)) {
    const view = body;
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return { bytes: copy.buffer as ArrayBuffer };
  }
  throw new TypeError("Unsupported fetch body type");
}

export async function streamFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = resolveUrl(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const signal = init?.signal;
  if (signal?.aborted) {
    throw createAbortError();
  }

  const builder = getNativeFetch().newBuilder(url);
  builder.setMethod(method);
  for (const [key, value] of iterateHeadersInit(init?.headers)) {
    builder.addHeader(key, value);
  }
  const body = encodeBody(init?.body);
  if (body.string !== undefined) {
    builder.setBodyString(body.string);
  } else if (body.bytes !== undefined) {
    builder.setBodyBytes(body.bytes);
  }

  return await new Promise<Response>((resolve, reject) => {
    let request: StreamFetchRequest | undefined;
    let settled = false;
    let cancelled = false;
    let streamController: {
      enqueue: (chunk: Uint8Array) => void;
      close: () => void;
      error: (error: unknown) => void;
    };

    const cleanupAbort = (): void => {
      if (signal == null || abortListener == null) return;
      signal.removeEventListener("abort", abortListener);
      abortListener = undefined;
    };

    let abortListener: (() => void) | undefined = () => {
      cancelled = true;
      try {
        request?.cancel();
      } catch {
        // Native cancel is best-effort.
      }
      if (!settled) return;
      try {
        streamController.error(createAbortError());
      } catch {
        // The stream may already be closed or errored.
      }
    };

    const bodyStream = createByteStream({
      start(controller) {
        streamController = controller;
      },
      cancel() {
        cancelled = true;
        cleanupAbort();
        try {
          request?.cancel();
        } catch {
          // Native cancel is best-effort.
        }
      },
    });

    builder.onResponse((info) => {
      if (settled || cancelled) return;
      settled = true;
      resolve(
        new StreamResponse({
          url: info.url,
          status: info.status,
          statusText: info.statusText,
          headers: info.headers,
          body: bodyStream,
        }) as unknown as Response,
      );
    });

    builder.onChunk((bytes) => {
      if (cancelled) return;
      streamController.enqueue(new Uint8Array(bytes));
    });

    builder.onComplete(() => {
      cleanupAbort();
      if (cancelled) return;
      streamController.close();
    });

    builder.onError((message) => {
      cleanupAbort();
      if (cancelled && settled) return;
      const error = signal?.aborted ? createAbortError() : new TypeError(message);
      if (!settled) {
        settled = true;
        reject(error);
        return;
      }
      streamController.error(error);
    });

    try {
      request = builder.build();
      if (signal != null) {
        signal.addEventListener("abort", abortListener, { once: true });
      }
      request.start();
    } catch (error) {
      cleanupAbort();
      if (!settled) {
        settled = true;
        reject(error instanceof Error ? error : new TypeError(String(error)));
      }
    }
  });
}

export function installStreamFetch(): void {
  const runtime = globalThis as { fetch?: typeof fetch };
  runtime.fetch = streamFetch as typeof fetch;
}
