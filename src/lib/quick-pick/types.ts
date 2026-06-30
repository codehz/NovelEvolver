import type { QuickPickDismissedError } from "./errors";

export type QuickPickListItem = {
  id: string;
  label: string;
  detail?: string;
  emphasized?: boolean;
};

export type QuickPickExtraItem = {
  id: string;
  label: string;
};

export type QuickPickListResult =
  | { kind: "item"; id: string }
  | { kind: "extra"; id: string; searchQuery: string };

export type ShowQuickPickListOptions = {
  title: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  items: QuickPickListItem[];
  extras?: QuickPickExtraItem[];
  emptyMessage?: string;
  dismissAriaLabel?: string;
};

export type ShowQuickPickInputOptions = {
  title: string;
  inputLabel?: string;
  placeholder?: string;
  initialValue?: string;
  hint?: string;
  validate?: (value: string) => string | null;
  dismissAriaLabel?: string;
};

export type QuickPickListSession = {
  requestId: string;
  kind: "list";
  options: ShowQuickPickListOptions;
};

export type QuickPickInputSession = {
  requestId: string;
  kind: "input";
  options: ShowQuickPickInputOptions;
};

export type QuickPickSession = QuickPickListSession | QuickPickInputSession;

export type QuickPickQueueEntry = QuickPickSession;

export type QuickPickSettleResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: QuickPickDismissedError };
