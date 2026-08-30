import type { RpcTransport } from "capnweb";

import type { AppRpcTransportBridge } from "#desktop-rpc/transport/index";
import {
  isAppRpcDisconnectFrame,
  isAppRpcMessageFrame,
  type AppRpcFrame,
} from "#desktop-rpc/transport/index";

type Deferred<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Promise<T> & Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  }) as Promise<T> & Deferred<T>;

  promise.resolve = resolve;
  promise.reject = reject;

  return promise;
}

export class RendererRpcTransport implements RpcTransport {
  readonly #bridge: AppRpcTransportBridge;
  readonly #sessionId: string;
  readonly #pendingMessages: string[] = [];
  readonly #pendingReceivers: Array<Deferred<string>> = [];
  readonly #disposeMessageListener: () => void;
  #closedError: Error | null = null;
  #nextOutgoingSeq = 1;
  #lastIncomingSeq = 0;

  constructor(bridge: AppRpcTransportBridge, sessionId: string) {
    this.#bridge = bridge;
    this.#sessionId = sessionId;
    this.#disposeMessageListener = this.#bridge.onMessage((frame) => {
      this.#handleFrame(frame);
    });
  }

  async send(message: string): Promise<void> {
    this.#throwIfClosed();

    await this.#bridge.send({
      type: "message",
      sessionId: this.#sessionId,
      seq: this.#nextOutgoingSeq++,
      payload: message,
    });
  }

  receive(): Promise<string> {
    if (this.#pendingMessages.length > 0) {
      return Promise.resolve(this.#pendingMessages.shift()!);
    }

    if (this.#closedError) {
      return Promise.reject(this.#closedError);
    }

    const deferred = createDeferred<string>();
    this.#pendingReceivers.push(deferred);
    return deferred;
  }

  abort(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    void this.disconnect(error.message);
  }

  async disconnect(reason?: string): Promise<void> {
    if (this.#closedError) {
      return;
    }

    this.close(reason ? new Error(reason) : new Error("RPC session disconnected."));
    await this.#bridge.disconnect({
      type: "disconnect",
      sessionId: this.#sessionId,
      reason,
    });
  }

  close(error = new Error("RPC session disconnected.")): void {
    if (this.#closedError) {
      return;
    }

    this.#closedError = error;
    this.#disposeMessageListener();

    while (this.#pendingReceivers.length > 0) {
      this.#pendingReceivers.shift()!.reject(error);
    }
  }

  #handleFrame(frame: AppRpcFrame): void {
    if (frame.sessionId !== this.#sessionId) {
      return;
    }

    if (isAppRpcDisconnectFrame(frame)) {
      this.close(frame.reason ? new Error(frame.reason) : new Error("RPC session disconnected."));
      return;
    }

    if (!isAppRpcMessageFrame(frame)) {
      return;
    }

    if (frame.seq <= this.#lastIncomingSeq) {
      return;
    }

    this.#lastIncomingSeq = frame.seq;

    const pendingReceiver = this.#pendingReceivers.shift();
    if (pendingReceiver) {
      pendingReceiver.resolve(frame.payload);
      return;
    }

    this.#pendingMessages.push(frame.payload);
  }

  #throwIfClosed(): void {
    if (this.#closedError) {
      throw this.#closedError;
    }
  }
}
