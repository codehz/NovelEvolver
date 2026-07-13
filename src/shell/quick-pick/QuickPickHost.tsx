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
import { QuickPickOverlay, useQuickPickRequestClose } from "./QuickPickOverlay";
import {
  QUICK_PICK_OPTION_INDEX_ATTR,
  useQuickPickListNavigation,
} from "./use-quick-pick-list-navigation";

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

function quickPickListRowKey(row: QuickPickListRow): string {
  if (row.kind === "divider") {
    return "quick-pick-divider";
  }
  if (row.kind === "item") {
    return row.item.id;
  }
  return row.extra.id;
}

function QuickPickListOption({
  index,
  highlighted,
  emphasized,
  onHighlight,
  onSelect,
  children,
}: {
  index: number;
  highlighted: boolean;
  emphasized?: boolean;
  onHighlight: () => void;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <li role="option" aria-selected={highlighted} {...{ [QUICK_PICK_OPTION_INDEX_ATTR]: index }}>
      <button
        type="button"
        className={cn(quickPickRowButtonClass, emphasized && quickPickRowEmphasisClass)}
        onMouseEnter={onHighlight}
        onClick={onSelect}
      >
        {highlighted ? (
          <motion.span
            layoutId={QUICK_PICK_HIGHLIGHT_LAYOUT_ID}
            className={quickPickRowHighlightSurfaceClass}
            transition={quickPickHighlightSurfaceTransition}
          />
        ) : null}
        <span className={quickPickRowButtonContentClass}>{children}</span>
      </button>
    </li>
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
  const listboxId = useId();
  const searchInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const requestClose = useQuickPickRequestClose();

  const filtered = useMemo(() => filterListItems(options.items, query), [options.items, query]);
  const extras = options.extras ?? [];
  const hasSearchQuery = query.trim() !== "";
  const listRows = useMemo(
    () => buildQuickPickListRows(filtered, extras, hasSearchQuery),
    [extras, filtered, hasSearchQuery],
  );
  const itemCount = filtered.length + extras.length;

  const resolveItem = useCallback(
    (id: string) => {
      requestClose(() => {
        quickPickHostApi.resolveList(requestId, { kind: "item", id });
      });
    },
    [requestClose, requestId],
  );

  const resolveExtra = useCallback(
    (extra: QuickPickExtraItem) => {
      requestClose(() => {
        quickPickHostApi.resolveList(requestId, {
          kind: "extra",
          id: extra.id,
          searchQuery: query,
        });
      });
    },
    [query, requestClose, requestId],
  );

  const { highlightIndex, setHighlightIndex, listRef, onSearchKeyDown, resetHighlight } =
    useQuickPickListNavigation({
      itemCount,
      onActivate: (index) => {
        let optionIndex = 0;
        for (const row of listRows) {
          if (row.kind === "divider") {
            continue;
          }
          if (optionIndex === index) {
            if (row.kind === "item") {
              resolveItem(row.item.id);
            } else {
              resolveExtra(row.extra);
            }
            resetHighlight();
            return;
          }
          optionIndex += 1;
        }
      },
    });

  useEffect(() => {
    setQuery("");
    resetHighlight();
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [requestId, resetHighlight]);

  return (
    <>
      <p className="sr-only" id={titleId}>
        {options.title}
      </p>
      <div className={quickPickSearchWrapClass}>
        <label className="sr-only" htmlFor={searchInputId}>
          {options.searchLabel ?? options.title}
        </label>
        <input
          ref={inputRef}
          id={searchInputId}
          className={quickPickSearchInputClass}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={options.searchPlaceholder ?? ""}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={onSearchKeyDown}
        />
      </div>
      <LayoutGroup id={`${listboxId}-highlight`}>
        <AutoTransition
          as="ul"
          ref={listRef}
          id={listboxId}
          className={quickPickListClass}
          role="listbox"
          aria-label={options.title}
          transition={quickPickListTransition}
          exitLayout="flow"
        >
          {itemCount === 0 ? (
            <li key="quick-pick-empty" className={quickPickEmptyClass}>
              {options.emptyMessage ?? "无匹配项"}
            </li>
          ) : (
            (() => {
              let optionIndex = 0;
              return listRows.map((row) => {
                if (row.kind === "divider") {
                  return (
                    <li
                      key={quickPickListRowKey(row)}
                      className={quickPickListDividerClass}
                      role="separator"
                      aria-hidden
                    />
                  );
                }
                const index = optionIndex;
                optionIndex += 1;
                if (row.kind === "item") {
                  const { item } = row;
                  return (
                    <QuickPickListOption
                      key={quickPickListRowKey(row)}
                      index={index}
                      highlighted={highlightIndex === index}
                      emphasized={item.emphasized}
                      onHighlight={() => {
                        setHighlightIndex(index);
                      }}
                      onSelect={() => {
                        resolveItem(item.id);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "icon-[codicon--check] size-4 shrink-0",
                          item.emphasized ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                      {item.detail ? (
                        <span className="shrink-0 font-mono text-xs text-app-muted">
                          {item.detail}
                        </span>
                      ) : null}
                    </QuickPickListOption>
                  );
                }
                const { extra } = row;
                return (
                  <QuickPickListOption
                    key={quickPickListRowKey(row)}
                    index={index}
                    highlighted={highlightIndex === index}
                    onHighlight={() => {
                      setHighlightIndex(index);
                    }}
                    onSelect={() => {
                      resolveExtra(extra);
                    }}
                  >
                    <span aria-hidden="true" className="icon-[codicon--add] size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{extra.label}</span>
                  </QuickPickListOption>
                );
              });
            })()
          )}
        </AutoTransition>
      </LayoutGroup>
    </>
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
