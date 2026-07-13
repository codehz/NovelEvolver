import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { useAnimatedContentHeight } from "#app/shared/lib/ui/animated-height";
import { cn } from "#app/shared/lib/ui/cn";

import {
  selectorEmptyClass,
  selectorListClass,
  selectorPanelContentClass,
  selectorPanelHeightShellClass,
  selectorRowButtonClass,
  selectorRowDetailClass,
  selectorRowEmphasisClass,
  selectorRowHighlightedClass,
  selectorRowLabelClass,
  selectorSearchInputClass,
  selectorSearchWrapClass,
} from "./ai-chat-selector-chrome";
import {
  AiChatSelectorPopoverContent,
  AiChatSelectorPopoverTarget,
  useAiChatSelectorRequestClose,
} from "./ai-chat-selector-popover";
import type { AiChatSelectorItem } from "./selector-items";
import {
  SELECTOR_OPTION_INDEX_ATTR,
  useSelectorListNavigation,
} from "./use-selector-list-navigation";

function filterItems(items: readonly AiChatSelectorItem[], query: string): AiChatSelectorItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return [...items];
  }
  return items.filter((item) => {
    const label = item.label.toLowerCase();
    const detail = item.detail?.toLowerCase() ?? "";
    return label.includes(normalized) || detail.includes(normalized);
  });
}

function SelectorOption({
  index,
  item,
  highlighted,
  onHighlight,
  onSelect,
}: {
  index: number;
  item: AiChatSelectorItem;
  highlighted: boolean;
  onHighlight: () => void;
  onSelect: () => void;
}) {
  return (
    <li role="option" aria-selected={highlighted} {...{ [SELECTOR_OPTION_INDEX_ATTR]: index }}>
      <button
        type="button"
        className={cn(
          selectorRowButtonClass,
          highlighted && selectorRowHighlightedClass,
          item.emphasized && selectorRowEmphasisClass,
        )}
        onMouseEnter={onHighlight}
        onClick={onSelect}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "icon-[codicon--check] size-3.5 shrink-0",
              item.emphasized ? "opacity-100" : "opacity-0",
            )}
          />
          <span className={selectorRowLabelClass}>{item.label}</span>
        </span>
        {item.detail ? (
          <span className={cn(selectorRowDetailClass, "pl-5")}>{item.detail}</span>
        ) : null}
      </button>
    </li>
  );
}

function AnchoredSelectorPickerBody({
  title,
  searchLabel,
  searchPlaceholder,
  emptyMessage,
  items,
  titleId,
  onSelect,
}: {
  title: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  items: readonly AiChatSelectorItem[];
  titleId: string;
  onSelect: (id: string) => void;
}) {
  const listboxId = useId();
  const searchInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const requestClose = useAiChatSelectorRequestClose();

  const filtered = useMemo(() => filterItems(items, query), [items, query]);

  const resolveItem = useCallback(
    (id: string) => {
      requestClose(() => {
        onSelect(id);
      });
    },
    [onSelect, requestClose],
  );

  const { highlightIndex, setHighlightIndex, listRef, onSearchKeyDown, resetHighlight } =
    useSelectorListNavigation({
      itemCount: filtered.length,
      onActivate: (index) => {
        const item = filtered[index];
        if (item != null) {
          resolveItem(item.id);
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
  }, [resetHighlight]);

  return (
    <>
      <p className="sr-only" id={titleId}>
        {title}
      </p>
      <div className={selectorSearchWrapClass}>
        <label className="sr-only" htmlFor={searchInputId}>
          {searchLabel}
        </label>
        <input
          ref={inputRef}
          id={searchInputId}
          className={selectorSearchInputClass}
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={searchPlaceholder}
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
        className={selectorListClass}
        role="listbox"
        aria-label={title}
      >
        {filtered.length === 0 ? (
          <li className={selectorEmptyClass}>{emptyMessage}</li>
        ) : (
          filtered.map((item, index) => (
            <SelectorOption
              key={item.id}
              index={index}
              item={item}
              highlighted={highlightIndex === index}
              onHighlight={() => {
                setHighlightIndex(index);
              }}
              onSelect={() => {
                resolveItem(item.id);
              }}
            />
          ))
        )}
      </ul>
    </>
  );
}

export function AnchoredSelectorPicker({
  panelId,
  panelClassName,
  title,
  searchLabel,
  searchPlaceholder,
  emptyMessage,
  items,
  onSelect,
}: {
  panelId: string;
  panelClassName: string;
  title: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  items: readonly AiChatSelectorItem[];
  onSelect: (id: string) => void;
}): ReactNode {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { heightPx: shellHeightPx } = useAnimatedContentHeight(contentRef, panelRef);

  return (
    <AiChatSelectorPopoverTarget
      ref={panelRef}
      id={panelId}
      aria-labelledby={titleId}
      className={panelClassName}
      role="dialog"
    >
      <div
        className={selectorPanelHeightShellClass}
        style={shellHeightPx != null ? { height: shellHeightPx } : undefined}
      >
        <div ref={contentRef} className={selectorPanelContentClass}>
          <AiChatSelectorPopoverContent>
            <AnchoredSelectorPickerBody
              title={title}
              searchLabel={searchLabel}
              searchPlaceholder={searchPlaceholder}
              emptyMessage={emptyMessage}
              items={items}
              titleId={titleId}
              onSelect={onSelect}
            />
          </AiChatSelectorPopoverContent>
        </div>
      </div>
    </AiChatSelectorPopoverTarget>
  );
}
