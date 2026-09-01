import type {
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "@novelevolver/domain/worktree";
import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { manuscriptParentChain } from "#app/features/project-workbench/explorer/manuscript/manuscript-tree";
import { manuscriptTreeMolecule } from "#app/features/project-workbench/explorer/manuscript/state/manuscript-tree-molecule";
import { resourceParentChain } from "#app/features/project-workbench/explorer/resource-library/resource-tree";
import { resourceLibraryTreeMolecule } from "#app/features/project-workbench/explorer/resource-library/state/resource-tree-molecule";

import type {
  ComparisonWorkbenchEditorTab,
  ManuscriptWorkbenchEditorTab,
  ResourceWorkbenchEditorTab,
  WorkbenchEditorTab,
} from "./state/types";

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

function buildComparisonBreadcrumbModel(
  tab: ComparisonWorkbenchEditorTab,
  context: EditorBreadcrumbContext,
): EditorBreadcrumbModel {
  const targetModel =
    tab.target.sourceTarget.domain === "manuscript"
      ? buildEditorBreadcrumbModel(
          manuscriptBreadcrumbDefinition,
          {
            id: `comparison-target:${tab.target.sourceTarget.entityId}`,
            kind: "manuscript",
            chapterId: tab.target.sourceTarget.entityId,
            label: tab.label,
          },
          context,
        )
      : buildEditorBreadcrumbModel(
          resourceBreadcrumbDefinition,
          {
            id: `comparison-target:${tab.target.sourceTarget.entityId}`,
            kind: "resource",
            resourceId: tab.target.sourceTarget.entityId,
            label: tab.label,
          },
          context,
        );

  const segments =
    targetModel.segments.length === 0
      ? [
          {
            key: "comparison-path",
            label: tab.displayPath,
            clickable: false,
            current: false,
          },
        ]
      : targetModel.segments.map((segment) => ({
          ...segment,
          current: false,
        }));

  const comparisonSuffix =
    tab.target.kind === "history-entry"
      ? "历史预览"
      : tab.target.kind === "commit-change"
        ? "提交预览"
        : "更改预览";
  const comparisonKey =
    tab.target.kind === "history-entry"
      ? `history-comparison:${tab.target.entryId}`
      : tab.target.kind === "commit-change"
        ? `commit-comparison:${tab.target.commitHash}:${tab.target.sourceTarget.domain}:${tab.target.sourceTarget.entityId}`
        : `change-comparison:${tab.target.sourceTarget.domain}:${tab.target.sourceTarget.entityId}`;
  const comparisonLabel =
    tab.target.kind === "history-entry"
      ? `预览 ${tab.target.entryShortHash ?? tab.target.entryMessage}`
      : tab.target.kind === "commit-change"
        ? `提交 ${tab.target.shortHash ?? tab.target.commitHash.slice(0, 7)}`
        : `预览 ${tab.target.changeKind}`;

  return {
    ariaLabel: `${targetModel.ariaLabel}${comparisonSuffix}`,
    segments: [
      ...segments,
      {
        key: comparisonKey,
        label: comparisonLabel,
        clickable: false,
        current: true,
      },
    ],
  };
}

const workbenchEditorBreadcrumbBuilders = {
  resource: (
    tab: ResourceWorkbenchEditorTab,
    context: EditorBreadcrumbContext,
  ): EditorBreadcrumbModel =>
    buildEditorBreadcrumbModel(resourceBreadcrumbDefinition, tab, context),
  manuscript: (
    tab: ManuscriptWorkbenchEditorTab,
    context: EditorBreadcrumbContext,
  ): EditorBreadcrumbModel =>
    buildEditorBreadcrumbModel(manuscriptBreadcrumbDefinition, tab, context),
  comparison: (
    tab: ComparisonWorkbenchEditorTab,
    context: EditorBreadcrumbContext,
  ): EditorBreadcrumbModel => buildComparisonBreadcrumbModel(tab, context),
} satisfies {
  [K in WorkbenchEditorTab["kind"]]: (
    tab: Extract<WorkbenchEditorTab, { kind: K }>,
    context: EditorBreadcrumbContext,
  ) => EditorBreadcrumbModel;
};

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

  return workbenchEditorBreadcrumbBuilders[tab.kind](tab as never, context);
}
