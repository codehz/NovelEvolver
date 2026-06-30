import { useAtomValue } from "jotai";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  FloatingPickerListbox,
  FloatingPickerOption,
  FloatingPickerSearchField,
  FloatingPickerShell,
  floatingPickerEmptyStateClass,
  floatingPickerInputClass,
  floatingPickerInputWrapClass,
  useFloatingPickerNavigation,
} from "@/components/floating-picker";
import { cn } from "@/lib/cn";
import {
  activeQuickPickSessionAtom,
  quickPickHostApi,
  type QuickPickExtraItem,
  type QuickPickListItem,
  type QuickPickListSession,
  type QuickPickInputSession,
} from "@/lib/quick-pick";

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

function QuickPickListPanel({ session }: { session: QuickPickListSession }) {
  const { requestId, options } = session;
  const titleId = useId();
  const listboxId = useId();
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

  const { highlightIndex, setHighlightIndex, listRef, onInputKeyDown, resetHighlight } =
    useFloatingPickerNavigation({
      itemCount,
      open: true,
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
    <FloatingPickerShell
      open
      onClose={dismiss}
      titleId={titleId}
      dismissAriaLabel={options.dismissAriaLabel ?? "关闭"}
    >
      <p className="sr-only" id={titleId}>
        {options.title}
      </p>
      <FloatingPickerSearchField
        titleId={titleId}
        listboxId={listboxId}
        inputRef={inputRef}
        label={options.searchLabel ?? options.title}
        placeholder={options.searchPlaceholder ?? ""}
        value={query}
        onChange={setQuery}
        onKeyDown={onInputKeyDown}
      />
      <FloatingPickerListbox listboxId={listboxId} listRef={listRef} ariaLabel={options.title}>
        {filtered.length === 0 && extras.length === 0 ? (
          <li className={floatingPickerEmptyStateClass}>{options.emptyMessage ?? "无匹配项"}</li>
        ) : null}
        {filtered.map((item, index) => (
          <FloatingPickerOption
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
          </FloatingPickerOption>
        ))}
        {extras.map((extra, extraIndex) => {
          const listIndex = filtered.length + extraIndex;
          return (
            <FloatingPickerOption
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
            </FloatingPickerOption>
          );
        })}
      </FloatingPickerListbox>
    </FloatingPickerShell>
  );
}

function QuickPickInputPanel({ session }: { session: QuickPickInputSession }) {
  const { requestId, options } = session;
  const titleId = useId();
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

  const inputId = useId();

  return (
    <FloatingPickerShell
      open
      onClose={dismiss}
      titleId={titleId}
      dismissAriaLabel={options.dismissAriaLabel ?? "关闭"}
    >
      <p className="sr-only" id={titleId}>
        {options.title}
      </p>
      <div className={floatingPickerInputWrapClass}>
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
          className={floatingPickerInputClass}
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
      {options.hint ? (
        <p className="shrink-0 border-t border-badge-background px-3 py-2 text-xs text-workbench-status-bar-muted">
          {options.hint}
        </p>
      ) : null}
    </FloatingPickerShell>
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
