import { AutoTransition, effects, preset } from "@codehz/auto-transition";
import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { Fragment, useCallback } from "react";

import { SlotText } from "#app/components/SlotText";
import { cn } from "#app/lib/cn";
import { resourceBaseName, resourceLibraryDirPathPrefixes } from "#shared/resource-library-path";

import { manuscriptParentChain } from "../../manuscript/manuscript-tree";
import { manuscriptTreeMolecule } from "../../manuscript/state/manuscript-tree-molecule";
import { resourceLibraryTreeMolecule } from "../../resource-library/state/resource-tree-molecule";
import type { WorkbenchEditorTab } from "../state/types";

type EditorBreadcrumbSegment = {
  key: string;
  label: string;
  clickable: boolean;
  current: boolean;
  onClick?: () => void;
};

function useResourceBreadcrumbSegments(resourcePath: string | null): EditorBreadcrumbSegment[] {
  const { revealInTree, treeUiAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatchUi = useSetAtom(treeUiAtom);

  const reveal = useCallback(
    (path: string) => {
      // 入队展开所有父级前缀（sync effect 会逐级加载并展开），再发出定位请求。
      const parentPrefixes = path === "" ? [] : resourceLibraryDirPathPrefixes(path).slice(0, -1);
      if (parentPrefixes.length > 0) {
        dispatchUi({ type: "enqueueExpandPaths", paths: parentPrefixes });
      }
      revealInTree(path);
    },
    [dispatchUi, revealInTree],
  );

  if (resourcePath === null) {
    return [];
  }

  const segments: EditorBreadcrumbSegment[] = [
    {
      key: "segment:0",
      label: "资源库",
      clickable: true,
      current: resourcePath === "",
      onClick: () => {
        reveal("");
      },
    },
  ];
  if (resourcePath === "") {
    return segments;
  }

  const prefixes = resourceLibraryDirPathPrefixes(resourcePath);
  for (const [index, prefix] of prefixes.entries()) {
    const isLast = prefix === resourcePath;
    segments.push({
      key: `segment:${index + 1}`,
      label: resourceBaseName(prefix),
      clickable: !isLast,
      current: isLast,
      onClick: isLast
        ? undefined
        : () => {
            reveal(prefix);
          },
    });
  }
  return segments;
}

function useManuscriptBreadcrumbSegments(chapterId: string | null): EditorBreadcrumbSegment[] {
  const { treeAtom } = useMolecule(manuscriptTreeMolecule);
  const state = useAtomValue(treeAtom);
  const dispatch = useSetAtom(treeAtom);

  const selectFolder = useCallback(
    (id: string) => {
      dispatch({ type: "expand", id });
      dispatch({ type: "select", id });
    },
    [dispatch],
  );

  if (chapterId === null || state.outline === null) {
    return [];
  }

  const chain = manuscriptParentChain(state.outline, chapterId);
  return chain.map((segment, index) => {
    const isLast = index === chain.length - 1;
    const clickable = segment.type === "folder" && !isLast;
    return {
      key: `segment:${index}`,
      label: segment.title,
      clickable,
      current: isLast,
      onClick: clickable
        ? () => {
            selectFolder(segment.id);
          }
        : undefined,
    };
  });
}

const breadcrumbButtonClass = cn("max-w-48 truncate rounded px-1 py-0.5 text-xs");
const breadcrumbCurrentButtonClass = cn("text-app-foreground");
const breadcrumbClickableButtonClass = cn(
  "text-ctp-subtext0 hover:bg-window-button-hover hover:text-app-foreground",
);
const breadcrumbCurrentTextClass = cn("max-w-48 truncate text-xs text-app-foreground");

export function EditorBreadcrumb({ tab }: { tab: WorkbenchEditorTab }) {
  const resourceSegments = useResourceBreadcrumbSegments(
    tab.kind === "resource" ? tab.resourcePath : null,
  );
  const manuscriptSegments = useManuscriptBreadcrumbSegments(
    tab.kind === "manuscript" ? tab.chapterId : null,
  );
  const segments = tab.kind === "resource" ? resourceSegments : manuscriptSegments;

  if (segments.length === 0) {
    return null;
  }

  return (
    <AutoTransition
      as="nav"
      aria-label={tab.kind === "resource" ? "资源路径" : "正文路径"}
      className="flex min-w-0 items-center gap-1"
      transition={breadcrumbTransitionPreset}
    >
      {segments.map((segment, index) => (
        <Fragment key={segment.key}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0"
            />
          ) : null}
          {segment.clickable ? (
            <button
              className={cn(
                breadcrumbButtonClass,
                segment.current ? breadcrumbCurrentButtonClass : breadcrumbClickableButtonClass,
              )}
              type="button"
              onClick={segment.onClick}
            >
              <SlotText text={segment.label} />
            </button>
          ) : (
            <SlotText text={segment.label} className={breadcrumbCurrentTextClass} />
          )}
        </Fragment>
      ))}
    </AutoTransition>
  );
}

const breadcrumbEase = "cubic-bezier(0.22, 1, 0.36, 1)";

const breadcrumbTransitionPreset = preset({
  enter: [effects.fade(0), effects.translate({ x: 8, y: 0 })],
  exit: [effects.fade(0), effects.translate({ x: -8, y: 0 })],
  move: effects.flip(),
  timing: {
    enter: { duration: 220, easing: breadcrumbEase },
    exit: { duration: 180, easing: breadcrumbEase },
    move: { duration: 320, easing: breadcrumbEase },
  },
});
