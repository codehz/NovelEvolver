export type ResourceSnapshotEntry = {
  id: string;
  type: "file" | "folder";
  name: string;
  parentId: string;
  index: number;
  depth: number;
  displayPath: string;
  order: number;
  content: string;
};

export type ResourceSnapshotState = {
  entries: Map<string, ResourceSnapshotEntry>;
};

export function cloneResourceSnapshotState(state: ResourceSnapshotState): ResourceSnapshotState {
  return {
    entries: new Map(
      [...state.entries.entries()].map(([id, entry]) => [
        id,
        {
          ...entry,
        },
      ]),
    ),
  };
}
