/**
 * Common RPC subscription shape.
 *
 * Methods that represent long-lived subscriptions should return a promise for
 * a readable stream. For state-style subscriptions, the first chunk should be
 * the current snapshot so consumers only need to read one channel.
 *
 * See `shared/rpc/README.md` for State / Directory / Value feed conventions.
 */

/** Snapshot-first envelope used by State feed and Directory feed. */
export type SnapshotEvent<TSnapshot> = {
  kind: "snapshot";
  snapshot: TSnapshot;
};

/**
 * Delta envelope for State feed.
 * Payload shape is domain-defined (`ops`, structured patch, etc.).
 */
export type DeltaEvent<TDelta> = {
  kind: "delta";
  delta: TDelta;
};

export type RpcReadableStreamLike<T> = Pick<ReadableStream<T>, "cancel" | "pipeTo">;

export type RpcSubscriptionResult<T> = PromiseLike<RpcReadableStreamLike<T>>;

export type RpcSubscribeFn<T> = () => RpcSubscriptionResult<T>;
