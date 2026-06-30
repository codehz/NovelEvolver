import type { ResourceNode } from "@shared/rpc/projects-rpc";

export type ResourceTreeNode = {
  path: string;
  name: string;
  type: ResourceNode["type"];
  expanded: boolean;
  loading: boolean;
  children: ResourceTreeNode[] | null;
};

export function childPath(parentPath: string, name: string): string {
  return parentPath === "" ? name : `${parentPath}/${name}`;
}

export function nodesToTreeChildren(path: string, nodes: ResourceNode[]): ResourceTreeNode[] {
  return nodes.map((node) => ({
    path: childPath(path, node.name),
    name: node.name,
    type: node.type,
    expanded: false,
    loading: false,
    children: node.type === "folder" ? null : [],
  }));
}

export function setNodeAtPath(
  roots: ResourceTreeNode[],
  targetPath: string,
  update: (node: ResourceTreeNode) => ResourceTreeNode,
): ResourceTreeNode[] {
  if (targetPath === "") {
    return roots;
  }

  return roots.map((node) => {
    if (node.path === targetPath) {
      return update(node);
    }
    if (node.type === "folder" && node.children && targetPath.startsWith(`${node.path}/`)) {
      return {
        ...node,
        children: setNodeAtPath(node.children, targetPath, update),
      };
    }
    return node;
  });
}
