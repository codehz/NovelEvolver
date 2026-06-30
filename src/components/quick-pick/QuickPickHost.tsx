import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  activeQuickPickSessionAtom,
  type QuickPickExtraItem,
  type QuickPickInputSession,
  type QuickPickListItem,
  type QuickPickListSession,
} from "@/lib/quick-pick";
import { quickPickHostApi } from "@/lib/quick-pick/api";

import {
  quickPickEmptyClass,
  quickPickFooterHintClass,
  quickPickListClass,
  quickPickListDividerClass,
  quickPickRowButtonClass,
  quickPickRowEmphasisClass,
  quickPickRowHighlightClass,
  quickPickSearchInputClass,
  quickPickSearchWrapClass,
  quickPickTextInputClass,
  quickPickTextInputWrapClass,
} from "./quick-pick-chrome";
import {
  quickPickListDividerMotion,
  quickPickListEmptyMotion,
  quickPickListRowMotion,
} from "./quick-pick-list-motion";
import { QuickPickOverlay } from "./QuickPickOverlay";
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
    <motion.li
      role="option"
      aria-selected={highlighted}
      {...{ [QUICK_PICK_OPTION_INDEX_ATTR]: index }}
      {...quickPickListRowMotion}
    >
      <button
        type="button"
        className={cn(
          quickPickRowButtonClass,
          highlighted && quickPickRowHighlightClass,
          emphasized && quickPickRowEmphasisClass,
        )}
        onMouseEnter={onHighlight}
        onClick={onSelect}
      >
        {children}
      </button>
    </motion.li>
  );
}

function QuickPickListPanel({ session }: { session: QuickPickListSession }) {
  const { requestId, options } = session;
  const titleId = useId();
  const listboxId = useId();
  const searchInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterListItems(options.items, query), [options.items, query]);
  const extras = options.extras ?? [];
  const hasSearchQuery = query.trim() !== "";
  const listRows = useMemo(
    () => buildQuickPickListRows(filtered, extras, hasSearchQuery),
    [extras, filtered, hasSearchQuery],
  );
  const itemCount = filtered.length + extras.length;

  const dismiss = useCallback(() => {
    quickPickHostApi.dismiss(requestId);
  }, [requestId]);

  const resolveItem = useCallback(
    (id: string) => {
      quickPickHostApi.resolveList(requestId, { kind: "item", id });
    },
    [requestId],
  );

  const resolveExtra = useCallback(
    (extra: QuickPickExtraItem) => {
      quickPickHostApi.resolveList(requestId, {
        kind: "extra",
        id: extra.id,
        searchQuery: query,
      });
    },
    [query, requestId],
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
    <QuickPickOverlay
      titleId={titleId}
      dismissAriaLabel={options.dismissAriaLabel ?? "关闭"}
      onDismiss={dismiss}
    >
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
      <ul
        ref={listRef}
        id={listboxId}
        className={quickPickListClass}
        role="listbox"
        aria-label={options.title}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {itemCount === 0 ? (
            <motion.li
              key="quick-pick-empty"
              className={quickPickEmptyClass}
              {...quickPickListEmptyMotion}
            >
              {options.emptyMessage ?? "无匹配项"}
            </motion.li>
          ) : (
            (() => {
              let optionIndex = 0;
              return listRows.map((row) => {
                if (row.kind === "divider") {
                  return (
                    <motion.li
                      key={quickPickListRowKey(row)}
                      className={quickPickListDividerClass}
                      role="separator"
                      aria-hidden
                      style={{ transformOrigin: "center" }}
                      {...quickPickListDividerMotion}
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
                        <span className="shrink-0 font-mono text-xs text-workbench-status-bar-muted">
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
        </AnimatePresence>
      </ul>
    </QuickPickOverlay>
  );
}

function QuickPickInputPanel({ session }: { session: QuickPickInputSession }) {
  const { requestId, options } = session;
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(options.initialValue ?? "");
  const [error, setError] = useState<string | null>(null);

  const dismiss = useCallback(() => {
    quickPickHostApi.dismiss(requestId);
  }, [requestId]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (options.validate != null) {
      const validationError = options.validate(trimmed);
      if (validationError != null) {
        setError(validationError);
        return;
      }
    }
    quickPickHostApi.resolveInput(requestId, trimmed);
  }, [options, requestId, value]);

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
    <QuickPickOverlay
      titleId={titleId}
      dismissAriaLabel={options.dismissAriaLabel ?? "关闭"}
      onDismiss={dismiss}
    >
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
          <p className="mt-1 text-xs text-notification-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {options.hint ? <p className={quickPickFooterHintClass}>{options.hint}</p> : null}
    </QuickPickOverlay>
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
