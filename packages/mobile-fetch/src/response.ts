import { StreamHeaders } from "./headers";
import type { StreamFetchHeader } from "./NativeStreamFetch.nitro";

export class StreamResponse {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: StreamHeaders;
  readonly redirected = false;
  readonly type = "basic";
  readonly body: ReadableStream<Uint8Array>;
  #bodyUsed = false;

  constructor(options: {
    url: string;
    status: number;
    statusText: string;
    headers: StreamFetchHeader[];
    body: ReadableStream<Uint8Array>;
  }) {
    this.url = options.url;
    this.status = options.status;
    this.statusText = options.statusText;
    this.ok = options.status >= 200 && options.status < 300;
    this.headers = new StreamHeaders(options.headers);
    this.body = options.body;
  }

  get bodyUsed(): boolean {
    return this.#bodyUsed;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const bytes = await this.#drain();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer as ArrayBuffer;
  }

  async text(): Promise<string> {
    const bytes = await this.#drain();
    return new TextDecoder().decode(bytes);
  }

  async json(): Promise<unknown> {
    return JSON.parse(await this.text());
  }

  async bytes(): Promise<Uint8Array> {
    return this.#drain();
  }

  async #drain(): Promise<Uint8Array> {
    if (this.#bodyUsed) {
      throw new TypeError("Body has already been consumed.");
    }
    this.#bodyUsed = true;
    const reader = this.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.byteLength;
        }
      }
    } finally {
      reader.releaseLock();
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }
}
