import { Combobox } from "@base-ui/react/combobox";
import { useId, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  selectorEmptyClass,
  selectorListClass,
  selectorPickerBodyClass,
  selectorPickerShellClass,
  selectorRowButtonClass,
  selectorRowDetailClass,
  selectorRowEmphasisClass,
  selectorRowLabelClass,
  selectorSearchInputClass,
  selectorSearchWrapClass,
} from "./ai-chat-selector-chrome";
import type { AiChatSelectorItem } from "./selector-items";

function filterSelectorItem(item: AiChatSelectorItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return true;
  }
  const label = item.label.toLowerCase();
  const detail = item.detail?.toLowerCase() ?? "";
  return label.includes(normalized) || detail.includes(normalized);
}

/** Selector list content with self-clamped native scroll (inside Base UI Popover.Popup). */
export function AnchoredSelectorPicker({
  title,
  searchLabel,
  searchPlaceholder,
  emptyMessage,
  items,
  open,
  onOpenChange,
  onSelect,
}: {
  title: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  items: readonly AiChatSelectorItem[];
  /** Bound to the host Popover so Escape / selection reset Combobox state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}): ReactNode {
  const titleId = useId();
  const selectedItem = items.find((item) => item.emphasized) ?? null;

  return (
    <div aria-labelledby={titleId}>
      <p className="sr-only" id={titleId}>
        {title}
      </p>
      <Combobox.Root
        // Base UI Aria supports "always"; public ComboboxRoot typedef is boolean-only.
        autoHighlight={"always" as never}
        filter={filterSelectorItem}
        inline
        isItemEqualToValue={(a, b) => a.id === b.id}
        itemToStringLabel={(item) => item.label}
        items={items}
        open={open}
        value={selectedItem}
        onOpenChange={(next) => {
          onOpenChange(next);
        }}
        onValueChange={(item) => {
          if (item != null) {
            onSelect(item.id);
          }
        }}
      >
        <div className={selectorPickerShellClass}>
          <div className={selectorSearchWrapClass}>
            <Combobox.Label className="sr-only">{searchLabel}</Combobox.Label>
            <Combobox.Input
              autoComplete="off"
              className={selectorSearchInputClass}
              placeholder={searchPlaceholder}
              spellCheck={false}
            />
          </div>
          <div className={selectorPickerBodyClass}>
            <Combobox.List aria-label={title} className={selectorListClass}>
              {(item: AiChatSelectorItem) => (
                <Combobox.Item
                  key={item.id}
                  className={cn(
                    selectorRowButtonClass,
                    item.emphasized && selectorRowEmphasisClass,
                  )}
                  value={item}
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
                </Combobox.Item>
              )}
            </Combobox.List>
            {/* Empty root stays mounted for a11y; style only the message so non-empty lists don't keep padding. */}
            <Combobox.Empty>
              <div className={selectorEmptyClass}>{emptyMessage}</div>
            </Combobox.Empty>
          </div>
        </div>
      </Combobox.Root>
    </div>
  );
}
