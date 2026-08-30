/** Snapshot-first envelope used by State feed and Directory feed. */
export type SnapshotEvent<TSnapshot> = {
  kind: "snapshot";
  snapshot: TSnapshot;
};

/** Delta envelope for State feed. Payload shape is domain-defined. */
export type DeltaEvent<TDelta> = {
  kind: "delta";
  delta: TDelta;
};
