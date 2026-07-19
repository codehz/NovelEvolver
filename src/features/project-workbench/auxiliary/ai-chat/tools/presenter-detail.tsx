import type { ReactNode } from "react";

import type { TechnicalField } from "./presenter-types";

type DetailFieldProps = {
  label: string;
  children: ReactNode;
};

export function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-ctp-subtext0">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-app-foreground">{children}</dd>
    </div>
  );
}

type DetailListProps = {
  children: ReactNode;
};

export function DetailList({ children }: DetailListProps) {
  return <dl className="flex flex-col gap-1.5">{children}</dl>;
}

type ActivityPathListProps = {
  items: readonly string[];
  emptyLabel?: string;
  maxItems?: number;
};

/** Compact path / hit list for search, changes, and similar expand bodies. */
export function ActivityPathList({
  items,
  emptyLabel = "无条目",
  maxItems = 8,
}: ActivityPathListProps) {
  if (items.length === 0) {
    return <p className="text-ctp-subtext0">{emptyLabel}</p>;
  }
  const visible = items.slice(0, maxItems);
  const remaining = items.length - visible.length;
  return (
    <ul className="flex flex-col gap-1">
      {visible.map((item, index) => (
        <li key={`${item}:${index}`} className="min-w-0 wrap-break-word">
          {item}
        </li>
      ))}
      {remaining > 0 ? <li className="text-ctp-subtext0">另有 {remaining} 项</li> : null}
    </ul>
  );
}

type SnippetPreviewProps = {
  label?: string;
  text: string;
};

/** Single-line snippet preview for replace / delete expand bodies. */
export function SnippetPreview({ label, text }: SnippetPreviewProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {label ? <span className="text-ctp-subtext0">{label}</span> : null}
      <p className="min-w-0 wrap-break-word text-app-foreground">{text}</p>
    </div>
  );
}

type ErrorTechnicalFieldsProps = {
  fields: readonly TechnicalField[];
};

/** Secondary technical fields — only assemble for `status === "error"`. */
export function ErrorTechnicalFields({ fields }: ErrorTechnicalFieldsProps) {
  if (fields.length === 0) {
    return null;
  }
  return (
    <dl className="flex flex-col gap-1 border-t border-titlebar-border/60 pt-1.5 text-2xs text-ctp-overlay0">
      {fields.map((field) => (
        <div key={field.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
          <dt className="text-ctp-overlay0">{field.label}</dt>
          <dd className="min-w-0 font-mono wrap-break-word text-ctp-subtext0">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Helper for presenters: only render technical fields on error. */
export function maybeErrorTechnicalFields(
  status: string,
  fields: ReadonlyArray<TechnicalField | null | false | undefined>,
) {
  if (status !== "error") {
    return null;
  }
  const list = fields.filter((field): field is TechnicalField => Boolean(field));
  return list.length > 0 ? <ErrorTechnicalFields fields={list} /> : null;
}
