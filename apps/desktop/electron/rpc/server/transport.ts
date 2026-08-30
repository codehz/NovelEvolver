import type { RpcTransport } from "capnweb";
import type { WebContents } from "electron";

import {
  APP_RPC_DISCONNECT_CHANNEL,
  APP_RPC_MESSAGE_CHANNEL,
  isAppRpcDisconnectFrame,
  isAppRpcMessageFrame,
  type AppRpcFrame,
} from "#shared/rpc/transport/index";

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

export class MainRpcTransport implements RpcTransport {
  readonly #webContents: WebContents;
  readonly #sessionId: string;
  readonly #pendingMessages: string[] = [];
  readonly #pendingReceivers: Array<Deferred<string>> = [];
  #closedError: Error | null = null;
  #nextOutgoingSeq = 1;
  #lastIncomingSeq = 0;

  constructor(webContents: WebContents, sessionId: string) {
    this.#webContents = webContents;
    this.#sessionId = sessionId;
  }

  async send(message: string): Promise<void> {
    this.#throwIfClosed();

    this.#webContents.send(APP_RPC_MESSAGE_CHANNEL, {
      type: "message",
      sessionId: this.#sessionId,
      seq: this.#nextOutgoingSeq++,
      payload: message,
    } satisfies AppRpcFrame);
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

  pushFrame(frame: AppRpcFrame): void {
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

  close(error = new Error("RPC session disconnected.")): void {
    if (this.#closedError) {
      return;
    }

    this.#closedError = error;

    while (this.#pendingReceivers.length > 0) {
      this.#pendingReceivers.shift()!.reject(error);
    }

    if (!this.#webContents.isDestroyed()) {
      this.#webContents.send(APP_RPC_DISCONNECT_CHANNEL, {
        type: "disconnect",
        sessionId: this.#sessionId,
        reason: error.message,
      } satisfies AppRpcFrame);
    }
  }

  abort(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.close(error);
  }

  #throwIfClosed(): void {
    if (this.#closedError) {
      throw this.#closedError;
    }
  }
}
