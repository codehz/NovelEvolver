import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { resourceBaseName, resourceLibraryDirPathPrefixes } from "#shared/resource-library-path";
import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/projects-rpc";

import { manuscriptParentChain } from "../../manuscript/manuscript-tree";
import { manuscriptTreeMolecule } from "../../manuscript/state/manuscript-tree-molecule";
import { resourceLibraryTreeMolecule } from "../../resource-library/state/resource-tree-molecule";
import type {
  ManuscriptWorkbenchEditorTab,
  ResourceWorkbenchEditorTab,
  WorkbenchEditorTab,
} from "../state/types";

export type EditorBreadcrumbSegment = {
  key: string;
  label: string;
  clickable: boolean;
  current: boolean;
  onClick?: () => void;
};

type EditorBreadcrumbModel = {
  ariaLabel: string;
  segments: EditorBreadcrumbSegment[];
};

type EditorBreadcrumbContext = {
  manuscriptOutline: ManuscriptOutline | null;
  revealManuscript: (id: string) => void;
  revealResource: (path: string) => void;
};

type EditorBreadcrumbDefinition<TTab extends WorkbenchEditorTab, TNode> = {
  ariaLabel: string;
  resolveNodes: (tab: TTab, context: EditorBreadcrumbContext) => readonly TNode[];
  getKey: (node: TNode, index: number) => string;
  getLabel: (node: TNode, index: number, nodes: readonly TNode[]) => string;
  isClickable: (node: TNode, index: number, nodes: readonly TNode[]) => boolean;
  reveal: (node: TNode, context: EditorBreadcrumbContext) => void;
};

const resourceBreadcrumbDefinition: EditorBreadcrumbDefinition<ResourceWorkbenchEditorTab, string> =
  {
    ariaLabel: "资源路径",
    resolveNodes: (tab) => ["", ...resourceLibraryDirPathPrefixes(tab.resourcePath)],
    getKey: (path) => (path === "" ? "resource:root" : `resource:${path}`),
    getLabel: (path) => (path === "" ? "资源库" : resourceBaseName(path)),
    isClickable: (path, index, nodes) => path === "" || index < nodes.length - 1,
    reveal: (path, context) => {
      context.revealResource(path);
    },
  };

const manuscriptBreadcrumbDefinition: EditorBreadcrumbDefinition<
  ManuscriptWorkbenchEditorTab,
  ManuscriptNode
> = {
  ariaLabel: "正文路径",
  resolveNodes: (tab, context) => {
    const outline = context.manuscriptOutline;
    if (outline === null) {
      return [];
    }
    return manuscriptParentChain(outline, tab.chapterId);
  },
  getKey: (node) => `manuscript:${node.id}`,
  getLabel: (node) => node.title,
  isClickable: (node, index, nodes) => node.type === "folder" && index < nodes.length - 1,
  reveal: (node, context) => {
    context.revealManuscript(node.id);
  },
};

function buildEditorBreadcrumbModel<TTab extends WorkbenchEditorTab, TNode>(
  definition: EditorBreadcrumbDefinition<TTab, TNode>,
  tab: TTab,
  context: EditorBreadcrumbContext,
): EditorBreadcrumbModel {
  const nodes = definition.resolveNodes(tab, context);
  const lastIndex = nodes.length - 1;

  return {
    ariaLabel: definition.ariaLabel,
    segments: nodes.map((node, index) => {
      const clickable = definition.isClickable(node, index, nodes);
      return {
        key: definition.getKey(node, index),
        label: definition.getLabel(node, index, nodes),
        clickable,
        current: index === lastIndex,
        onClick: clickable
          ? () => {
              definition.reveal(node, context);
            }
          : undefined,
      };
    }),
  };
}

export function useEditorBreadcrumb(tab: WorkbenchEditorTab): EditorBreadcrumbModel {
  const { revealInTree: revealResource } = useMolecule(resourceLibraryTreeMolecule);
  const { treeAtom, revealInTree: revealManuscript } = useMolecule(manuscriptTreeMolecule);
  const manuscriptOutline = useAtomValue(treeAtom).outline;

  const context: EditorBreadcrumbContext = {
    manuscriptOutline,
    revealManuscript,
    revealResource,
  };

  // Breadcrumb variants share rendering; only chain resolution and reveal policy differ.
  switch (tab.kind) {
    case "resource":
      return buildEditorBreadcrumbModel(resourceBreadcrumbDefinition, tab, context);
    case "manuscript":
      return buildEditorBreadcrumbModel(manuscriptBreadcrumbDefinition, tab, context);
  }
}
