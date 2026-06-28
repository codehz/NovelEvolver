export type ProjectRecord = {
  id: number;
  path: string;
  lastOpenedAt: number;
};

/** Project row for UI lists; `displayPath` shortens the user home prefix to `~`. */
export type ProjectListItem = ProjectRecord & {
  displayPath: string;
};