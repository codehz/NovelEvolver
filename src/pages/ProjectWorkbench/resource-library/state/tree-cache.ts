import type { ResourceNode } from "@shared/rpc/projects-rpc";

import { childPath, type ResourceTreeNode } from "../resource-tree";
import type { DirListingState, ResourceTreeDataState } from "./types";

function sortEntries(nodes: ResourceNode[]): ResourceNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "folder" ? -1 : 1;
  });
}

function listingEntries(listing: DirListingState | undefined): ResourceNode[] | null {
  if (listing?.status === "ready") {
    return listing.entries;
  }
  return null;
}

function isListingLoading(listing: DirListingState | undefined): boolean {
  return listing?.status === "loading";
}

/** 由规范化 cache 派生 UI 树（仅观察层，不写入 state）。 */
export function buildVisibleResourceTree(state: ResourceTreeDataState): ResourceTreeNode[] {
  if (state.status !== "ready") {
    return [];
  }
  const rootListing = state.listings[""];
  const rootEntries = listingEntries(rootListing);
  if (rootEntries === null) {
    return [];
  }
  return buildNodesAtParent("", rootEntries, state);
}

function buildNodesAtParent(
  parentPath: string,
  entries: ResourceNode[],
  state: ResourceTreeDataState,
): ResourceTreeNode[] {
  return sortEntries(entries).map((entry) => {
    const path = childPath(parentPath, entry.name);
    if (entry.type !== "folder") {
      return {
        path,
        name: entry.name,
        type: "file" as const,
        expanded: false,
        loading: false,
        children: [],
      };
    }
    const expanded = path in state.expandedPaths;
    const listing = state.listings[path];
    const loading = isListingLoading(listing);
    const childEntries = listingEntries(listing);
    let children: ResourceTreeNode[] | null = [];
    if (!expanded) {
      children = [];
    } else if (childEntries === null) {
      children = null;
    } else {
      children = buildNodesAtParent(path, childEntries, state);
    }
    return {
      path,
      name: entry.name,
      type: "folder" as const,
      expanded,
      loading,
      children,
    };
  });
}

/** 已展开但尚未拉取或正在拉取子列表的目录 path。 */
export function collectExpandedPathsNeedingLoad(state: ResourceTreeDataState): string[] {
  if (state.status !== "ready") {
    return [];
  }
  const paths: string[] = [];
  const walkEntries = (parentPath: string, entries: ResourceNode[]) => {
    for (const entry of entries) {
      if (entry.type !== "folder") {
        continue;
      }
      const path = childPath(parentPath, entry.name);
      if (!(path in state.expandedPaths)) {
        continue;
      }
      const listing = state.listings[path];
      if (listing === undefined || listing.status === "idle") {
        paths.push(path);
      } else if (listing.status === "ready") {
        walkEntries(path, listing.entries);
      }
    }
  };
  const rootEntries = listingEntries(state.listings[""]);
  if (rootEntries) {
    walkEntries("", rootEntries);
  }
  return paths;
}

export function folderExistsInTree(state: ResourceTreeDataState, path: string): boolean {
  if (path === "") {
    return true;
  }
  const segments = path.split("/");
  let parentPath = "";
  let entries = listingEntries(state.listings[""]);
  if (!entries) {
    return false;
  }
  for (const segment of segments) {
    const found = entries.find((e) => e.name === segment);
    if (!found || found.type !== "folder") {
      return false;
    }
    parentPath = childPath(parentPath, segment);
    if (parentPath === path) {
      return true;
    }
    entries = listingEntries(state.listings[parentPath]);
    if (!entries) {
      return false;
    }
  }
  return false;
}
