/** Project metadata shared across RPC; `displayPath` shortens the user home prefix to `~`. */
export type ProjectMetadata = {
  id: number;
  path: string;
  lastOpenedAt: number;
  displayPath: string;
  /** Custom display name; null falls back to path-derived name. */
  displayName: string | null;
};
