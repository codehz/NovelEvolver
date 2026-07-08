import { Children, isValidElement, memo, type ReactElement, type ReactNode } from "react";
import type { ExtraProps } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";

const tableCardsClass = cn("my-3 flex flex-col gap-2");
const tableCardClass = cn(
  "rounded-xl border border-titlebar-border bg-app-surface/60 px-3 py-2 shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--color-ctp-surface0)_18%,transparent)]",
);
const tableCardFieldClass = cn(
  "flex flex-col gap-0.5 py-1.5",
  "not-first:border-t not-first:border-titlebar-border/40",
);
const tableCardLabelClass = cn("text-2xs font-medium tracking-[0.02em] text-ctp-subtext0");
const tableCardValueClass = cn("text-[0.8125rem] leading-5 text-app-foreground");

type TableStructure = {
  headers: ReactNode[];
  rows: ReactNode[][];
};

type StreamdownTableElementProps = {
  children?: ReactNode;
  node?: {
    tagName?: string;
  };
};

function getElementTagName(element: ReactElement<StreamdownTableElementProps>): string | undefined {
  const nodeTagName = element.props.node?.tagName;
  if (typeof nodeTagName === "string") {
    return nodeTagName;
  }
}

function collectRowCells(
  row: ReactElement<StreamdownTableElementProps>,
  target: ReactNode[],
): void {
  Children.forEach(row.props.children, (cell) => {
    if (!isValidElement<StreamdownTableElementProps>(cell)) {
      return;
    }

    const tagName = getElementTagName(cell);
    if (tagName === "th" || tagName === "td") {
      target.push(cell.props.children);
    }
  });
}

function collectBodyRows(sectionChildren: ReactNode, target: ReactNode[][]): void {
  Children.forEach(sectionChildren, (row) => {
    if (!isValidElement<StreamdownTableElementProps>(row)) {
      return;
    }

    if (getElementTagName(row) !== "tr") {
      return;
    }

    const cells: ReactNode[] = [];
    collectRowCells(row, cells);
    if (cells.length > 0) {
      target.push(cells);
    }
  });
}

function collectHeaderCells(sectionChildren: ReactNode, target: ReactNode[]): void {
  Children.forEach(sectionChildren, (row) => {
    if (!isValidElement<StreamdownTableElementProps>(row)) {
      return;
    }

    if (getElementTagName(row) !== "tr") {
      return;
    }

    collectRowCells(row, target);
  });
}

function extractTableStructure(children: ReactNode): TableStructure {
  const headers: ReactNode[] = [];
  const rows: ReactNode[][] = [];

  Children.forEach(children, (section) => {
    if (!isValidElement<StreamdownTableElementProps>(section)) {
      return;
    }

    const tagName = getElementTagName(section);
    if (tagName === "thead") {
      collectHeaderCells(section.props.children, headers);
      return;
    }

    if (tagName === "tbody") {
      collectBodyRows(section.props.children, rows);
      return;
    }

    if (tagName === "tr") {
      const cells: ReactNode[] = [];
      collectRowCells(section, cells);
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
  });

  return { headers, rows };
}

function describeColumnLabel(headers: ReactNode[], columnIndex: number): ReactNode {
  const header = headers[columnIndex];
  if (header === undefined || header === null || header === "") {
    return `列 ${columnIndex + 1}`;
  }

  return header;
}

function MarkdownTableCardsComponent({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
} & ExtraProps) {
  const { headers, rows } = extractTableStructure(children);

  if (rows.length === 0) {
    return null;
  }

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), headers.length);

  return (
    <div className={cn(tableCardsClass, className)} data-streamdown="table-cards">
      {rows.map((row, rowIndex) => (
        <article className={tableCardClass} data-streamdown="table-card" key={rowIndex}>
          {Array.from({ length: columnCount }, (_, columnIndex) => {
            const value = row[columnIndex];
            if (value === undefined) {
              return null;
            }

            return (
              <div className={tableCardFieldClass} key={columnIndex}>
                <span className={tableCardLabelClass}>
                  {describeColumnLabel(headers, columnIndex)}
                </span>
                <div className={tableCardValueClass}>{value}</div>
              </div>
            );
          })}
        </article>
      ))}
    </div>
  );
}

export const MarkdownTableCards = memo(MarkdownTableCardsComponent);
