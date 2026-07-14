import { Children, isValidElement, memo, type ReactElement, type ReactNode } from "react";
import type { ExtraProps } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";

const tableCardsClass = cn("my-3");
const tableCardClass = cn("rounded-lg border border-titlebar-border bg-app-surface px-2.5 py-1");
const tableCardRowClass = cn(
  "flex flex-wrap gap-x-4 gap-y-1.5 py-1.5",
  "not-first:border-t not-first:border-titlebar-border/40",
);
const tableCardFieldClass = cn("flex min-w-24 flex-col gap-0.5");
const tableCardLabelClass = cn("text-2xs font-medium tracking-[0.02em] text-ctp-subtext0");
const tableCardValueClass = cn("text-chat leading-5 text-app-foreground");

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
    <article
      className={cn(tableCardsClass, tableCardClass, className)}
      data-streamdown="table-cards"
    >
      {rows.map((row, rowIndex) => (
        <div className={tableCardRowClass} data-streamdown="table-card" key={rowIndex}>
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
        </div>
      ))}
    </article>
  );
}

export const MarkdownTableCards = memo(MarkdownTableCardsComponent);
