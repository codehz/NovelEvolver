import { AutoTransition } from "@codehz/auto-transition";
import { useMolecule } from "bunshi/react";
import { useSetAtom } from "jotai";
import { Fragment, useCallback } from "react";
import { SlotText } from "slot-text/react";

import { cn } from "#app/lib/cn";
import { resourceBaseName, resourceLibraryDirPathPrefixes } from "#shared/resource-library-path";

import { resourceLibraryTreeMolecule } from "../../resource-library/state/resource-tree-molecule";

/** 面包屑单段：根节点固定为"资源库"，其余段为路径上的目录/文件名。 */
type BreadcrumbSegment = {
  /** 该段对应的完整资源路径；根段为 `""`。 */
  path: string;
  label: string;
  /** 末段（文件）不可点击跳转，仅展示。 */
  clickable: boolean;
};

function buildBreadcrumbSegments(resourcePath: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ path: "", label: "资源库", clickable: true }];
  if (resourcePath === "") {
    return segments;
  }
  const prefixes = resourceLibraryDirPathPrefixes(resourcePath);
  for (const prefix of prefixes) {
    const isLast = prefix === resourcePath;
    segments.push({
      path: prefix,
      label: resourceBaseName(prefix),
      clickable: !isLast,
    });
  }
  return segments;
}

export function EditorBreadcrumb({ resourcePath }: { resourcePath: string | null }) {
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
    return <span className="text-ctp-overlay0">未打开文件</span>;
  }

  const segments = buildBreadcrumbSegments(resourcePath);

  return (
    <AutoTransition as="nav" aria-label="资源路径" className="flex min-w-0 items-center gap-1">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <Fragment key={isLast ? "LAST" : index}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0"
              />
            ) : null}
            {segment.clickable ? (
              <button
                className={cn(
                  "max-w-48 truncate rounded px-1 py-0.5 text-xs",
                  isLast
                    ? "text-app-foreground"
                    : "text-ctp-subtext0 hover:bg-window-button-hover hover:text-app-foreground",
                )}
                type="button"
                onClick={() => {
                  reveal(segment.path);
                }}
              >
                <SlotText text={segment.label} />
              </button>
            ) : (
              <SlotText
                text={segment.label}
                className="max-w-48 truncate text-xs text-app-foreground"
              />
            )}
          </Fragment>
        );
      })}
    </AutoTransition>
  );
}
