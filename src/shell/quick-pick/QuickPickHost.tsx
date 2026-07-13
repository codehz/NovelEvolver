import { Combobox } from "@base-ui/react/combobox";
import { AutoTransition } from "@codehz/auto-transition";
import { useAtomValue } from "jotai";
import { LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import {
  activeQuickPickSessionAtom,
  type QuickPickExtraItem,
  type QuickPickInputSession,
  type QuickPickListItem,
  type QuickPickListSession,
} from "#app/shared/lib/quick-pick";
import { quickPickHostApi } from "#app/shared/lib/quick-pick/api";
import { cn } from "#app/shared/lib/ui/cn";

import {
  quickPickEmptyClass,
  quickPickFooterHintClass,
  quickPickListClass,
  quickPickListDividerClass,
  quickPickRowButtonClass,
  quickPickRowButtonContentClass,
  quickPickRowEmphasisClass,
  quickPickRowHighlightSurfaceClass,
  quickPickSearchInputClass,
  quickPickSearchWrapClass,
  quickPickTextInputClass,
  quickPickTextInputWrapClass,
} from "./quick-pick-chrome";
import {
  QUICK_PICK_HIGHLIGHT_LAYOUT_ID,
  quickPickHighlightSurfaceTransition,
  quickPickListTransition,
} from "./quick-pick-list-motion";
import {
  QuickPickOverlay,
  useQuickPickOverlayOpen,
  useQuickPickRequestClose,
} from "./QuickPickOverlay";

type QuickPickSelectable =
  | {
      kind: "item";
      id: string;
      label: string;
      detail?: string;
      emphasized?: boolean;
      showDividerBefore: boolean;
    }
  | {
      kind: "extra";
      id: string;
      label: string;
      showDividerBefore: boolean;
    };

function filterListItems(items: QuickPickListItem[], query: string): QuickPickListItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return items;
  }
  return items.filter((item) => {
    const label = item.label.toLowerCase();
    const detail = item.detail?.toLowerCase() ?? "";
    return label.includes(normalized) || detail.includes(normalized);
  });
}

type QuickPickListRow =
  | { kind: "item"; item: QuickPickListItem }
  | { kind: "extra"; extra: QuickPickExtraItem }
  | { kind: "divider" };

function buildQuickPickListRows(
  filtered: QuickPickListItem[],
  extras: QuickPickExtraItem[],
  hasSearchQuery: boolean,
): QuickPickListRow[] {
  const showDivider = extras.length > 0 && filtered.length > 0;
  if (!hasSearchQuery) {
    const rows: QuickPickListRow[] = extras.map((extra) => ({ kind: "extra", extra }));
    if (showDivider) {
      rows.push({ kind: "divider" });
    }
    for (const item of filtered) {
      rows.push({ kind: "item", item });
    }
    return rows;
  }
  const rows: QuickPickListRow[] = filtered.map((item) => ({ kind: "item", item }));
  if (showDivider) {
    rows.push({ kind: "divider" });
  }
  for (const extra of extras) {
    rows.push({ kind: "extra", extra });
  }
  return rows;
}

function toSelectableItems(rows: readonly QuickPickListRow[]): QuickPickSelectable[] {
  const items: QuickPickSelectable[] = [];
  let pendingDivider = false;
  for (const row of rows) {
    if (row.kind === "divider") {
      pendingDivider = true;
      continue;
    }
    if (row.kind === "item") {
      items.push({
        kind: "item",
        id: row.item.id,
        label: row.item.label,
        detail: row.item.detail,
        emphasized: row.item.emphasized,
        showDividerBefore: pendingDivider,
      });
    } else {
      items.push({
        kind: "extra",
        id: row.extra.id,
        label: row.extra.label,
        showDividerBefore: pendingDivider,
      });
    }
    pendingDivider = false;
  }
  return items;
}

function selectableKey(item: QuickPickSelectable): string {
  return `${item.kind}:${item.id}`;
}

function isSameSelectable(a: QuickPickSelectable, b: QuickPickSelectable): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function QuickPickListOption({
  item,
  highlighted,
  children,
}: {
  item: QuickPickSelectable;
  highlighted: boolean;
  children: ReactNode;
}) {
  return (
    <Combobox.Item
      className={cn(
        quickPickRowButtonClass,
        item.showDividerBefore && quickPickListDividerClass,
        item.kind === "item" && item.emphasized && quickPickRowEmphasisClass,
      )}
      value={item}
    >
      {highlighted ? (
        <motion.span
          layoutId={QUICK_PICK_HIGHLIGHT_LAYOUT_ID}
          className={quickPickRowHighlightSurfaceClass}
          transition={quickPickHighlightSurfaceTransition}
        />
      ) : null}
      <span className={quickPickRowButtonContentClass}>{children}</span>
    </Combobox.Item>
  );
}

function QuickPickListPanel({ session }: { session: QuickPickListSession }) {
  const { requestId } = session;
  const titleId = useId();
  const dismiss = useCallback(() => {
    quickPickHostApi.dismiss(requestId);
  }, [requestId]);

  return (
    <QuickPickOverlay titleId={titleId} onDismiss={dismiss}>
      <QuickPickListPanelBody session={session} titleId={titleId} />
    </QuickPickOverlay>
  );
}

function QuickPickListPanelBody({
  session,
  titleId,
}: {
  session: QuickPickListSession;
  titleId: string;
}) {
  const { requestId, options } = session;
  const open = useQuickPickOverlayOpen();
  const requestClose = useQuickPickRequestClose();
  const [query, setQuery] = useState("");
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const filtered = useMemo(() => filterListItems(options.items, query), [options.items, query]);
  const extras = options.extras ?? [];
  const hasSearchQuery = query.trim() !== "";
  const selectableItems = useMemo(
    () => toSelectableItems(buildQuickPickListRows(filtered, extras, hasSearchQuery)),
    [extras, filtered, hasSearchQuery],
  );

  const resolveSelectable = useCallback(
    (item: QuickPickSelectable) => {
      if (item.kind === "item") {
        requestClose(() => {
          quickPickHostApi.resolveList(requestId, { kind: "item", id: item.id });
        });
        return;
      }
      requestClose(() => {
        quickPickHostApi.resolveList(requestId, {
          kind: "extra",
          id: item.id,
          searchQuery: query,
        });
      });
    },
    [query, requestClose, requestId],
  );

  useEffect(() => {
    setQuery("");
    setHighlightedKey(null);
  }, [requestId]);

  return (
    <Combobox.Root
      // Base UI Aria supports "always"; public ComboboxRoot typedef is boolean-only.
      autoHighlight={"always" as never}
      filter={null}
      inline
      isItemEqualToValue={isSameSelectable}
      itemToStringLabel={(item) => item.label}
      items={selectableItems}
      open={open}
      value={null}
      inputValue={query}
      onInputValueChange={(next) => {
        setQuery(next);
      }}
      onOpenChange={(next) => {
        if (!next) {
          requestClose(() => {
            quickPickHostApi.dismiss(requestId);
          });
        }
      }}
      onItemHighlighted={(item) => {
        setHighlightedKey(item == null ? null : selectableKey(item));
      }}
      onValueChange={(item) => {
        if (item != null) {
          resolveSelectable(item);
        }
      }}
    >
      <p className="sr-only" id={titleId}>
        {options.title}
      </p>
      <div className={quickPickSearchWrapClass}>
        <Combobox.Label className="sr-only">{options.searchLabel ?? options.title}</Combobox.Label>
        <Combobox.Input
          autoComplete="off"
          className={quickPickSearchInputClass}
          placeholder={options.searchPlaceholder ?? ""}
          spellCheck={false}
        />
      </div>
      <LayoutGroup id={`${requestId}-highlight`}>
        <Combobox.List
          aria-label={options.title}
          className={quickPickListClass}
          render={
            <AutoTransition as="div" transition={quickPickListTransition} exitLayout="flow" />
          }
        >
          {(item: QuickPickSelectable) => (
            <QuickPickListOption
              key={selectableKey(item)}
              item={item}
              highlighted={highlightedKey === selectableKey(item)}
            >
              {item.kind === "item" ? (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "icon-[codicon--check] size-4 shrink-0",
                      item.emphasized ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  {item.detail ? (
                    <span className="shrink-0 font-mono text-xs text-app-muted">{item.detail}</span>
                  ) : null}
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="icon-[codicon--add] size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                </>
              )}
            </QuickPickListOption>
          )}
        </Combobox.List>
      </LayoutGroup>
      {/* Empty root stays mounted for a11y; style only the message so non-empty lists don't keep padding. */}
      <Combobox.Empty>
        <div className={quickPickEmptyClass}>{options.emptyMessage ?? "无匹配项"}</div>
      </Combobox.Empty>
    </Combobox.Root>
  );
}

function QuickPickInputPanel({ session }: { session: QuickPickInputSession }) {
  const { requestId } = session;
  const titleId = useId();
  const dismiss = useCallback(() => {
    quickPickHostApi.dismiss(requestId);
  }, [requestId]);

  return (
    <QuickPickOverlay titleId={titleId} onDismiss={dismiss}>
      <QuickPickInputPanelBody session={session} titleId={titleId} />
    </QuickPickOverlay>
  );
}

function QuickPickInputPanelBody({
  session,
  titleId,
}: {
  session: QuickPickInputSession;
  titleId: string;
}) {
  const { requestId, options } = session;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(options.initialValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const requestClose = useQuickPickRequestClose();

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (options.validate != null) {
      const validationError = options.validate(trimmed);
      if (validationError != null) {
        setError(validationError);
        return;
      }
    }
    requestClose(() => {
      quickPickHostApi.resolveInput(requestId, trimmed);
    });
  }, [options, requestClose, requestId, value]);

  useEffect(() => {
    setValue(options.initialValue ?? "");
    setError(null);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [options.initialValue, requestId]);

  return (
    <>
      <p className="sr-only" id={titleId}>
        {options.title}
      </p>
      <div className={quickPickTextInputWrapClass}>
        <label className="sr-only" htmlFor={inputId}>
          {options.inputLabel ?? options.title}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={options.placeholder ?? ""}
          className={quickPickTextInputClass}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        {error ? (
          <p className="mt-1 text-xs text-ctp-red" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {options.hint ? <p className={quickPickFooterHintClass}>{options.hint}</p> : null}
    </>
  );
}

export function QuickPickHost() {
  const session = useAtomValue(activeQuickPickSessionAtom);
  if (session == null) {
    return null;
  }
  if (session.kind === "list") {
    return <QuickPickListPanel key={session.requestId} session={session} />;
  }
  return <QuickPickInputPanel key={session.requestId} session={session} />;
}
