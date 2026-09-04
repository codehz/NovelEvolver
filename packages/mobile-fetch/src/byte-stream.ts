type StreamController<T> = {
  enqueue: (chunk: T) => void;
  close: () => void;
  error: (error: unknown) => void;
};

type ByteStreamSource = {
  start: (controller: StreamController<Uint8Array>) => void;
  cancel?: () => void;
};

type PendingRead<T> = {
  resolve: (result: ReadableStreamReadResult<T>) => void;
  reject: (error: unknown) => void;
};

class PolyfillByteStream {
  #chunks: Uint8Array[] = [];
  #pending: PendingRead<Uint8Array>[] = [];
  #closed = false;
  #errored: unknown;
  #locked = false;
  #cancelSource: (() => void) | undefined;

  constructor(source: ByteStreamSource) {
    this.#cancelSource = source.cancel;
    source.start({
      enqueue: (chunk) => this.#enqueue(chunk),
      close: () => this.#close(),
      error: (error) => this.#error(error),
    });
  }

  getReader(): ReadableStreamDefaultReader<Uint8Array> {
    if (this.#locked) {
      throw new TypeError("ReadableStream is locked");
    }
    this.#locked = true;
    return {
      read: () => this.#read(),
      cancel: async () => {
        this.#cancelSource?.();
        this.#close();
      },
      releaseLock: () => {
        this.#locked = false;
      },
    } as ReadableStreamDefaultReader<Uint8Array>;
  }

  #enqueue(chunk: Uint8Array): void {
    if (this.#closed || this.#errored !== undefined) return;
    const waiting = this.#pending.shift();
    if (waiting) {
      waiting.resolve({ done: false, value: chunk });
      return;
    }
    this.#chunks.push(chunk);
  }

  #close(): void {
    if (this.#closed || this.#errored !== undefined) return;
    this.#closed = true;
    for (const waiting of this.#pending) {
      waiting.resolve({ done: true, value: undefined });
    }
    this.#pending = [];
  }

  #error(error: unknown): void {
    if (this.#closed || this.#errored !== undefined) return;
    this.#errored = error;
    for (const waiting of this.#pending) {
      waiting.reject(error);
    }
    this.#pending = [];
  }

  #read(): Promise<ReadableStreamReadResult<Uint8Array>> {
    if (this.#errored !== undefined) {
      return Promise.reject(this.#errored);
    }
    const chunk = this.#chunks.shift();
    if (chunk) {
      return Promise.resolve({ done: false, value: chunk });
    }
    if (this.#closed) {
      return Promise.resolve({ done: true, value: undefined });
    }
    return new Promise((resolve, reject) => {
      this.#pending.push({ resolve, reject });
    });
  }
}

export function createByteStream(source: ByteStreamSource): ReadableStream<Uint8Array> {
  if (typeof ReadableStream === "function") {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        source.start({
          enqueue: (chunk) => controller.enqueue(chunk),
          close: () => controller.close(),
          error: (error) => controller.error(error),
        });
      },
      cancel() {
        source.cancel?.();
      },
    });
  }
  return new PolyfillByteStream(source) as unknown as ReadableStream<Uint8Array>;
}
