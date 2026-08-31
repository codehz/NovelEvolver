type RpcStreamSubscriptionRecord<T> = {
  controller: ReadableStreamDefaultController<T>;
};

type RpcStreamSubscribeOptions<T> = {
  getInitialValue?: () => T;
};

export class RpcStreamPublisher<T> {
  readonly #subscriptions = new Map<number, RpcStreamSubscriptionRecord<T>>();
  #nextSubscriptionId = 1;
  #disposed = false;

  subscribe(options: RpcStreamSubscribeOptions<T> = {}): ReadableStream<T> {
    const id = this.#nextSubscriptionId++;

    return new ReadableStream<T>({
      start: (controller) => {
        if (this.#disposed) {
          // Prefer error over silent empty close so clients leave "loading"
          // instead of hanging forever when a disposed publisher is reused.
          controller.error(new Error("RpcStreamPublisher has been disposed."));
          return;
        }

        this.#subscriptions.set(id, { controller });

        if (options.getInitialValue) {
          controller.enqueue(options.getInitialValue());
        }
      },
      cancel: () => {
        this.removeSubscription(id);
      },
    });
  }

  emit(value: T): void {
    if (this.#disposed) {
      return;
    }

    for (const [id, record] of this.#subscriptions) {
      try {
        record.controller.enqueue(value);
      } catch {
        this.removeSubscription(id);
      }
    }
  }

  removeSubscription(id: number): void {
    const record = this.#subscriptions.get(id);
    if (!record) {
      return;
    }

    this.#subscriptions.delete(id);
    try {
      record.controller.close();
    } catch {
      // Ignore controllers already closed or canceled by the consumer.
    }
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;

    for (const id of this.#subscriptions.keys()) {
      this.removeSubscription(id);
    }
  }
}
