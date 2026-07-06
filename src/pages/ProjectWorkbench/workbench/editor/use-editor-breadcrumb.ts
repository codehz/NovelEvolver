import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import type {
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

import { manuscriptParentChain } from "../explorer/manuscript/manuscript-tree";
import { manuscriptTreeMolecule } from "../explorer/manuscript/state/manuscript-tree-molecule";
import { resourceParentChain } from "../explorer/resource-library/resource-tree";
import { resourceLibraryTreeMolecule } from "../explorer/resource-library/state/resource-tree-molecule";
import type {
  ManuscriptWorkbenchEditorTab,
  ResourceWorkbenchEditorTab,
  TimelinePreviewWorkbenchEditorTab,
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
  manuscriptSnapshot: ManuscriptTreeSnapshot | null;
  resourceSnapshot: ResourceTreeSnapshot | null;
  revealManuscript: (id: string) => void;
  revealResource: (id: string) => void;
};

type EditorBreadcrumbDefinition<TTab extends WorkbenchEditorTab, TNode> = {
  ariaLabel: string;
  resolveNodes: (tab: TTab, context: EditorBreadcrumbContext) => readonly TNode[];
  getKey: (node: TNode, index: number) => string;
  getLabel: (node: TNode, index: number, nodes: readonly TNode[]) => string;
  isClickable: (node: TNode, index: number, nodes: readonly TNode[]) => boolean;
  reveal: (node: TNode, context: EditorBreadcrumbContext) => void;
};

const resourceBreadcrumbDefinition: EditorBreadcrumbDefinition<
  ResourceWorkbenchEditorTab,
  ResourceTreeNode
> = {
  ariaLabel: "资源路径",
  resolveNodes: (tab, context) => {
    const snapshot = context.resourceSnapshot;
    if (snapshot === null) {
      return [];
    }
    return resourceParentChain(snapshot, tab.resourceId);
  },
  getKey: (node) => `resource:${node.id}`,
  getLabel: (node, index) => (index === 0 ? "资源库" : node.name),
  isClickable: (_, index, nodes) => index < nodes.length - 1,
  reveal: (node, context) => {
    context.revealResource(node.id);
  },
};

const manuscriptBreadcrumbDefinition: EditorBreadcrumbDefinition<
  ManuscriptWorkbenchEditorTab,
  ManuscriptTreeNode
> = {
  ariaLabel: "正文路径",
  resolveNodes: (tab, context) => {
    const snapshot = context.manuscriptSnapshot;
    if (snapshot === null) {
      return [];
    }
    return manuscriptParentChain(snapshot, tab.chapterId);
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

function buildTimelinePreviewBreadcrumbModel(
  tab: TimelinePreviewWorkbenchEditorTab,
  context: EditorBreadcrumbContext,
): EditorBreadcrumbModel {
  const targetModel =
    tab.target.domain === "manuscript"
      ? buildEditorBreadcrumbModel(
          manuscriptBreadcrumbDefinition,
          {
            id: `timeline-target:${tab.target.entityId}`,
            kind: "manuscript",
            chapterId: tab.target.entityId,
            label: tab.label,
            active: tab.active,
            preview: false,
            initialContent: tab.currentContent,
          },
          context,
        )
      : buildEditorBreadcrumbModel(
          resourceBreadcrumbDefinition,
          {
            id: `timeline-target:${tab.target.entityId}`,
            kind: "resource",
            resourceId: tab.target.entityId,
            label: tab.label,
            active: tab.active,
            preview: false,
            initialContent: tab.currentContent,
          },
          context,
        );

  const segments =
    targetModel.segments.length === 0
      ? [
          {
            key: "timeline-preview-path",
            label: tab.displayPath,
            clickable: false,
            current: false,
          },
        ]
      : targetModel.segments.map((segment) => ({
          ...segment,
          current: false,
        }));

  return {
    ariaLabel: `${targetModel.ariaLabel}时间线预览`,
    segments: [
      ...segments,
      {
        key: `timeline-preview:${tab.entryId}`,
        label: `预览 ${tab.entryShortHash ?? tab.entryMessage}`,
        clickable: false,
        current: true,
      },
    ],
  };
}

export function useEditorBreadcrumb(tab: WorkbenchEditorTab): EditorBreadcrumbModel {
  const { treeAtom: resourceTreeAtom, revealInTree: revealResource } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const { treeAtom: manuscriptTreeAtom, revealInTree: revealManuscript } =
    useMolecule(manuscriptTreeMolecule);
  const manuscriptSnapshot = useAtomValue(manuscriptTreeAtom).snapshot;
  const resourceSnapshot = useAtomValue(resourceTreeAtom).snapshot;

  const context: EditorBreadcrumbContext = {
    manuscriptSnapshot,
    resourceSnapshot,
    revealManuscript,
    revealResource,
  };

  switch (tab.kind) {
    case "resource":
      return buildEditorBreadcrumbModel(resourceBreadcrumbDefinition, tab, context);
    case "manuscript":
      return buildEditorBreadcrumbModel(manuscriptBreadcrumbDefinition, tab, context);
    case "timeline-preview":
      return buildTimelinePreviewBreadcrumbModel(tab, context);
  }
}
