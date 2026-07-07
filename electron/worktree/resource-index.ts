import type { ResourceTreeNode, ResourceTreeSnapshot } from "#shared/rpc/worktree-tree-rpc";

export const RESOURCE_ROOT_ID = "root";

type ResourceIndexNode =
  | {
      id: string;
      type: "folder";
      name: string;
      parentId: string | null;
      children: string[];
    }
  | {
      id: string;
      type: "file";
      name: string;
      parentId: string | null;
    };

type ResourceIndex = {
  version: 1;
  rootId: typeof RESOURCE_ROOT_ID;
  nodes: Record<string, ResourceIndexNode>;
};

export function parseResourceIndex(content: string | null): ResourceIndex {
  if (content === null) {
    return {
      version: 1,
      rootId: RESOURCE_ROOT_ID,
      nodes: {
        [RESOURCE_ROOT_ID]: {
          id: RESOURCE_ROOT_ID,
          type: "folder",
          name: "",
          parentId: null,
          children: [],
        },
      },
    };
  }

  const value: unknown = JSON.parse(content);
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { version?: unknown }).version !== 1 ||
    (value as { rootId?: unknown }).rootId !== RESOURCE_ROOT_ID ||
    typeof (value as { nodes?: unknown }).nodes !== "object" ||
    (value as { nodes?: unknown }).nodes === null
  ) {
    throw new Error("Invalid resource index.");
  }

  const nodes = (value as ResourceIndex).nodes;
  const root = nodes[RESOURCE_ROOT_ID];
  if (root?.type !== "folder" || root.parentId !== null) {
    throw new Error("Invalid resource index root.");
  }
  return value as ResourceIndex;
}

export function resourceIndexFromTree(tree: ResourceTreeSnapshot): ResourceIndex {
  const nodes: Record<string, ResourceIndexNode> = {};
  for (const [id, node] of Object.entries(tree.nodes)) {
    nodes[id] =
      node.type === "folder"
        ? {
            id,
            type: "folder",
            name: node.name,
            parentId: node.parentId,
            children: [...node.childIds],
          }
        : {
            id,
            type: "file",
            name: node.name,
            parentId: node.parentId,
          };
  }
  return {
    version: 1,
    rootId: RESOURCE_ROOT_ID,
    nodes,
  };
}

export function resourceTreeFromIndex(index: ResourceIndex): ResourceTreeSnapshot {
  const nodes: Record<string, ResourceTreeNode> = {};
  for (const [id, node] of Object.entries(index.nodes)) {
    nodes[id] = {
      id,
      type: node.type,
      name: node.name,
      parentId: node.parentId,
      childIds: node.type === "folder" ? [...node.children] : [],
    };
  }
  const root = nodes[RESOURCE_ROOT_ID];
  if (root === undefined || root.type !== "folder" || root.parentId !== null) {
    throw new Error("Resource root is missing.");
  }
  return {
    rootId: RESOURCE_ROOT_ID,
    nodes,
  };
}
