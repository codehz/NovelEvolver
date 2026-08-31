import type { ExternalImportEntry, ExternalImportSkip } from "./external-import";

export type { ExternalImportEntry, ExternalImportSkip };

export type ManuscriptNodeType = "folder" | "chapter";

export type ManuscriptFolderNode = {
  id: string;
  type: "folder";
  title: string;
  children: string[];
};

export type ManuscriptChapterNode = {
  id: string;
  type: "chapter";
  title: string;
};

export type ManuscriptNode = ManuscriptFolderNode | ManuscriptChapterNode;

export type ManuscriptOutline = {
  version: 1;
  rootId: "root";
  nodes: Record<string, ManuscriptNode>;
};

export function validateOutline(value: unknown): ManuscriptOutline {
  if (typeof value !== "object" || value === null) {
    throw new Error("Manuscript outline must be an object.");
  }
  const outline = value as Partial<ManuscriptOutline>;
  if (outline.version !== 1) {
    throw new Error("Unsupported manuscript outline version.");
  }
  if (outline.rootId !== "root") {
    throw new Error("Manuscript outline rootId must be root.");
  }
  if (typeof outline.nodes !== "object" || outline.nodes === null || Array.isArray(outline.nodes)) {
    throw new Error("Manuscript outline nodes must be an object.");
  }

  const nodes: Record<string, ManuscriptNode> = {};
  for (const [id, rawNode] of Object.entries(outline.nodes as Record<string, unknown>)) {
    if (id !== "root" && !/^[\w-]{10}$/.test(id)) {
      throw new Error(`Invalid manuscript node id: ${id}`);
    }
    if (typeof rawNode !== "object" || rawNode === null || Array.isArray(rawNode)) {
      throw new Error(`Invalid manuscript node: ${id}`);
    }
    const node = rawNode as Partial<ManuscriptNode>;
    if (node.id !== id) {
      throw new Error(`Manuscript node id mismatch: ${id}`);
    }
    if (typeof node.title !== "string" || node.title.trim() === "") {
      throw new Error(`Manuscript node title must not be empty: ${id}`);
    }
    if (node.type === "folder") {
      const children = node.children;
      if (!Array.isArray(children) || children.some((child) => typeof child !== "string")) {
        throw new Error(`Manuscript folder children must be string IDs: ${id}`);
      }
      nodes[id] = { id, type: "folder", title: node.title, children: [...children] };
    } else if (node.type === "chapter") {
      if ("children" in node) {
        throw new Error(`Manuscript chapter must be a leaf node: ${id}`);
      }
      nodes[id] = { id, type: "chapter", title: node.title };
    } else {
      throw new Error(`Invalid manuscript node type: ${id}`);
    }
  }

  const root = nodes.root;
  if (root === undefined || root.type !== "folder") {
    throw new Error("Manuscript root folder is missing.");
  }

  const parentById = new Map<string, string>();
  for (const node of Object.values(nodes)) {
    if (node.type !== "folder") continue;
    const seenChildren = new Set<string>();
    for (const childId of node.children) {
      if (seenChildren.has(childId)) {
        throw new Error(`Manuscript folder contains duplicate child: ${childId}`);
      }
      seenChildren.add(childId);
      if (nodes[childId] === undefined) {
        throw new Error(`Manuscript child does not exist: ${childId}`);
      }
      if (childId === "root") {
        throw new Error("Manuscript root cannot be a child node.");
      }
      if (parentById.has(childId)) {
        throw new Error(`Manuscript node has multiple parents: ${childId}`);
      }
      parentById.set(childId, node.id);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Manuscript outline contains a cycle at: ${id}`);
    visiting.add(id);
    const node = nodes[id];
    if (node?.type === "folder") {
      for (const childId of node.children) visit(childId);
    }
    visiting.delete(id);
    visited.add(id);
  };
  visit("root");
  if (visited.size !== Object.keys(nodes).length) {
    throw new Error("Manuscript outline contains unreachable nodes.");
  }

  return { version: 1, rootId: "root", nodes };
}

export type WorktreeNodeIdResult = {
  nodeId: string;
};

export type ManuscriptImportCreated = {
  nodeId: string;
  relativePath: string;
  kind: "chapter" | "folder";
};

export type ManuscriptImportResult = {
  created: ManuscriptImportCreated[];
  skipped: ExternalImportSkip[];
};
