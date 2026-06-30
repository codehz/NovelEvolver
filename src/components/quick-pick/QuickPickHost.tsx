import { useAtomValue } from "jotai";
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
  quickPickRowButtonClass,
  quickPickRowEmphasisClass,
  quickPickRowHighlightClass,
  quickPickSearchInputClass,
  quickPickSearchWrapClass,
  quickPickTextInputClass,
  quickPickTextInputWrapClass,
} from "./quick-pick-chrome";
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
    </li>
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
        if (index < filtered.length) {
          const item = filtered[index];
          if (item != null) {
            resolveItem(item.id);
            resetHighlight();
          }
          return;
        }
        const extra = extras[index - filtered.length];
        if (extra != null) {
          resolveExtra(extra);
          resetHighlight();
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
        {filtered.length === 0 && extras.length === 0 ? (
          <li className={quickPickEmptyClass}>{options.emptyMessage ?? "无匹配项"}</li>
        ) : null}
        {filtered.map((item, index) => (
          <QuickPickListOption
            key={item.id}
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
        ))}
        {extras.map((extra, extraIndex) => {
          const listIndex = filtered.length + extraIndex;
          return (
            <QuickPickListOption
              key={extra.id}
              index={listIndex}
              highlighted={highlightIndex === listIndex}
              onHighlight={() => {
                setHighlightIndex(listIndex);
              }}
              onSelect={() => {
                resolveExtra(extra);
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--add] size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">{extra.label}</span>
            </QuickPickListOption>
          );
        })}
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
