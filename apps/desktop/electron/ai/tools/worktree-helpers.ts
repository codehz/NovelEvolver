import type { WorktreeSession } from "@novelevolver/worktree";

export function findCreatedNodePath(
  worktree: WorktreeSession,
  domain: "manuscript" | "resource",
  parentId: string,
  nodeId: string,
): string {
  const structure = worktree.getProjectStructure({ domain, id: parentId });
  const nodes = domain === "manuscript" ? structure.manuscript?.nodes : structure.resource?.nodes;
  const node = nodes?.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`创建后的节点不存在: ${nodeId}`);
  }
  return node.displayPath;
}
