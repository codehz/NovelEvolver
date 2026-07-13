import type {
  AiProjectStructure,
  AiProjectStructureManuscriptNode,
  AiProjectStructureResourceNode,
} from "../../../worktree/session";
import { parseDocumentTarget, parseToolArgs } from "../parse";
import type { ToolSpec } from "../types";

type ProjectStructureTree<TNode> = {
  root_id: string;
  nodes: TNode[];
};

type ProjectStructureManuscriptNodeDto = {
  id: string;
  domain: "manuscript";
  kind: "folder" | "chapter";
  title: string;
  parent_id: string | null;
  display_path: string;
  child_count?: number;
  descendant_count?: number;
  expanded?: boolean;
};

type ProjectStructureResourceNodeDto = {
  id: string;
  domain: "resource";
  kind: "folder" | "file";
  name: string;
  parent_id: string | null;
  display_path: string;
  child_count?: number;
  descendant_count?: number;
  expanded?: boolean;
};

type GetProjectStructureResult = {
  budget: number;
  node_count: number;
  target?: { domain: "manuscript" | "resource"; id: string };
  manuscript?: ProjectStructureTree<ProjectStructureManuscriptNodeDto>;
  resource?: ProjectStructureTree<ProjectStructureResourceNodeDto>;
};

function toManuscriptNodeDto(
  node: AiProjectStructureManuscriptNode,
): ProjectStructureManuscriptNodeDto {
  return {
    id: node.id,
    domain: node.domain,
    kind: node.kind,
    title: node.title,
    parent_id: node.parentId,
    display_path: node.displayPath,
    child_count: node.childCount,
    descendant_count: node.descendantCount,
    expanded: node.expanded,
  };
}

function toResourceNodeDto(node: AiProjectStructureResourceNode): ProjectStructureResourceNodeDto {
  return {
    id: node.id,
    domain: node.domain,
    kind: node.kind,
    name: node.name,
    parent_id: node.parentId,
    display_path: node.displayPath,
    child_count: node.childCount,
    descendant_count: node.descendantCount,
    expanded: node.expanded,
  };
}

function toProjectStructureResult(structure: AiProjectStructure): GetProjectStructureResult {
  return {
    budget: structure.budget,
    node_count: structure.nodeCount,
    target: structure.target,
    manuscript:
      structure.manuscript === undefined
        ? undefined
        : {
            root_id: structure.manuscript.rootId,
            nodes: structure.manuscript.nodes.map(toManuscriptNodeDto),
          },
    resource:
      structure.resource === undefined
        ? undefined
        : {
            root_id: structure.resource.rootId,
            nodes: structure.resource.nodes.map(toResourceNodeDto),
          },
  };
}

export const readStructureSpec: ToolSpec<"read_structure"> = {
  name: "read_structure",
  definition: {
    description:
      "按固定预算获取项目结构摘要，不返回正文。首次无参数调用可同时浏览手稿和资源；结果会优先完整返回根的直接子级，并在预算内自动展开较小目录。目录 expanded=false 表示其子级未包含，可将该目录作为 target 继续读取。",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              enum: ["manuscript", "resource"],
            },
            id: {
              type: "string",
              description: "此前结构结果中 expanded=false 的 folder ID。",
            },
          },
          required: ["domain", "id"],
          additionalProperties: false,
          description: "可选；从指定文件夹继续读取。省略时返回手稿和资源的统一摘要。",
        },
      },
      additionalProperties: false,
    },
  },
  run({ worktree, call }) {
    const args = parseToolArgs(call);
    if (args.target === undefined) {
      return toProjectStructureResult(worktree.getProjectStructure());
    }
    const resolved = parseDocumentTarget(args.target);
    return toProjectStructureResult(worktree.getProjectStructure(resolved));
  },
};
