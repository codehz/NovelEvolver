import { Popover } from "@base-ui/react/popover";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  slashPickerBodyClass,
  slashPickerDetailClass,
  slashPickerEmptyClass,
  slashPickerHeaderClass,
  slashPickerLabelClass,
  slashPickerListClass,
  slashPickerPanelClass,
  slashPickerPositionerClass,
  slashPickerRowClass,
  slashPickerShellClass,
} from "./composer-chrome";
import { filterPromptSlashItems, type PromptSlashItem } from "./slash-query";

export type SlashPickerAnchor = {
  getBoundingClientRect: () => DOMRect;
};

type SlashCommandPickerProps = {
  open: boolean;
  query: string;
  items: readonly PromptSlashItem[];
  loading: boolean;
  error: string | null;
  anchor: SlashPickerAnchor | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: PromptSlashItem) => void;
};

function createFallbackAnchor(): SlashPickerAnchor {
  return {
    getBoundingClientRect: () => DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 }),
  };
}

export function SlashCommandPicker({
  open,
  query,
  items,
  loading,
  error,
  anchor,
  onOpenChange,
  onSelect,
}: SlashCommandPickerProps): ReactNode {
  const titleId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Keep last rect so exit animation does not jump to (0,0) when parent clears anchor. */
  const lastAnchorRef = useRef<SlashPickerAnchor | null>(null);
  if (anchor) {
    lastAnchorRef.current = anchor;
  }

  const filtered = useMemo(() => filterPromptSlashItems(items, query), [items, query]);
  const resolvedAnchor = anchor ?? lastAnchorRef.current ?? createFallbackAnchor();

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open, filtered.length]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
        return;
      }

      if (filtered.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index + 1) % filtered.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        const item = filtered[activeIndex];
        if (!item) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onSelect(item);
      }
    };

    // Capture so CM default bindings / composer Enter-to-send do not win.
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [activeIndex, filtered, onOpenChange, onSelect, open]);

  const emptyMessage = (() => {
    if (loading && items.length === 0) {
      return "加载提示词…";
    }
    if (error) {
      return `加载失败：${error}`;
    }
    if (items.length === 0) {
      return "还没有提示词。请到「设置 → AI 提示词」添加。";
    }
    return "没有匹配的提示词";
  })();

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Portal>
        <Popover.Positioner
          className={slashPickerPositionerClass}
          anchor={resolvedAnchor}
          side="top"
          align="start"
          sideOffset={6}
          positionMethod="fixed"
        >
          <Popover.Popup className={slashPickerPanelClass} finalFocus={false} initialFocus={false}>
            <div aria-labelledby={titleId} className={slashPickerShellClass}>
              <p className={slashPickerHeaderClass} id={titleId}>
                插入提示词模板
                {query !== "" ? ` · /${query}` : ""}
              </p>
              <div className={slashPickerBodyClass} ref={listRef}>
                {filtered.length === 0 ? (
                  <p className={slashPickerEmptyClass}>{emptyMessage}</p>
                ) : (
                  <div className={slashPickerListClass} role="listbox" aria-label="提示词模板">
                    {filtered.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        data-index={index}
                        data-active={index === activeIndex ? "" : undefined}
                        className={cn(slashPickerRowClass)}
                        onMouseEnter={() => {
                          setActiveIndex(index);
                        }}
                        onClick={() => {
                          onSelect(item);
                        }}
                      >
                        <span className={slashPickerLabelClass}>{item.label}</span>
                        <span className={slashPickerDetailClass}>{item.detail}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
