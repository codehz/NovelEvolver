import type { AiChatMentionRef } from "@novelevolver/domain/ai";
import type {
  ManuscriptOutline,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "@novelevolver/domain/worktree";

import { findManuscriptParentId } from "../manuscript/manuscript-tree-flatten";

export type MentionCatalogItem = {
  domain: AiChatMentionRef["domain"];
  id: string;
  kind: AiChatMentionRef["kind"];
  label: string;
  displayPath: string;
};

export function kindLabelFor(
  kind: AiChatMentionRef["kind"],
  domain: AiChatMentionRef["domain"],
): string {
  if (kind === "folder") {
    return domain === "manuscript" ? "文件夹" : "资源文件夹";
  }
  if (kind === "chapter") {
    return "章节";
  }
  return "资源";
}

function manuscriptDisplayPath(outline: ManuscriptOutline, id: string): string {
  const parts: string[] = [];
  let current: string | null = id;
  while (current !== null && current !== outline.rootId) {
    const node = outline.nodes[current];
    if (node === undefined) {
      break;
    }
    parts.unshift(node.title);
    current = findManuscriptParentId(outline, current);
  }
  return parts.join("/");
}

function resourceDisplayPath(tree: ResourceTreeSnapshot, id: string): string {
  const parts: string[] = [];
  let current: string | null = id;
  while (current !== null && current !== tree.rootId) {
    const node: ResourceTreeNode | undefined = tree.nodes[current];
    if (node === undefined) {
      break;
    }
    parts.unshift(node.name);
    current = node.parentId;
  }
  return parts.join("/");
}

export function listMentionCatalog(
  outline: ManuscriptOutline,
  resourceTree: ResourceTreeSnapshot,
): MentionCatalogItem[] {
  const items: MentionCatalogItem[] = [];
  for (const node of Object.values(outline.nodes)) {
    if (node.id === outline.rootId) {
      continue;
    }
    items.push({
      domain: "manuscript",
      id: node.id,
      kind: node.type,
      label: node.title,
      displayPath: manuscriptDisplayPath(outline, node.id),
    });
  }
  for (const node of Object.values(resourceTree.nodes)) {
    if (node.id === resourceTree.rootId) {
      continue;
    }
    items.push({
      domain: "resource",
      id: node.id,
      kind: node.type,
      label: node.name,
      displayPath: resourceDisplayPath(resourceTree, node.id),
    });
  }
  return items;
}

export function buildMentionToken(
  item: Pick<MentionCatalogItem, "id" | "label" | "displayPath">,
  existingTokens: ReadonlySet<string>,
): string {
  const basePath = item.displayPath !== "" ? item.displayPath : item.label;
  const preferred = `@${basePath}`;
  if (!existingTokens.has(preferred)) {
    return preferred;
  }
  const shortId = item.id.length > 8 ? item.id.slice(0, 8) : item.id;
  const disambiguated = `@${basePath}#${shortId}`;
  if (!existingTokens.has(disambiguated)) {
    return disambiguated;
  }
  let index = 2;
  let token = `${disambiguated}-${index}`;
  while (existingTokens.has(token)) {
    index += 1;
    token = `${disambiguated}-${index}`;
  }
  return token;
}

export function toMentionRef(item: MentionCatalogItem, token: string): AiChatMentionRef {
  return {
    domain: item.domain,
    id: item.id,
    kind: item.kind,
    label: item.label,
    displayPath: item.displayPath,
    token,
  };
}
