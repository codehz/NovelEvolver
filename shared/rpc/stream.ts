/**
 * Common RPC subscription shape.
 *
 * Methods that represent long-lived subscriptions should return a promise for
 * a readable stream. For state-style subscriptions, the first chunk should be
 * the current snapshot so consumers only need to read one channel.
 */
export type RpcReadableSubscriptionStream<T> = Pick<ReadableStream<T>, "cancel" | "pipeTo">;

export type RpcSubscriptionStream<T> = PromiseLike<RpcReadableSubscriptionStream<T>>;

export type RpcStreamSubscribe<T> = () => RpcSubscriptionStream<T>;
