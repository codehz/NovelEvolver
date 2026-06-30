import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

import {
  floatingPickerRowClass,
  floatingPickerRowEmphasisClass,
  floatingPickerRowHighlightClass,
} from "./floating-picker-chrome";
import { FLOATING_PICKER_OPTION_INDEX_ATTR } from "./floating-picker-navigation";

export type FloatingPickerOptionProps = {
  index: number;
  highlighted: boolean;
  emphasized?: boolean;
  onHighlight: () => void;
  onSelect: () => void;
  children: ReactNode;
};

export function FloatingPickerOption({
  index,
  highlighted,
  emphasized = false,
  onHighlight,
  onSelect,
  children,
}: FloatingPickerOptionProps) {
  return (
    <li
      role="option"
      aria-selected={highlighted}
      {...{ [FLOATING_PICKER_OPTION_INDEX_ATTR]: index }}
    >
      <button
        type="button"
        className={cn(
          floatingPickerRowClass,
          highlighted && floatingPickerRowHighlightClass,
          emphasized && floatingPickerRowEmphasisClass,
        )}
        onMouseEnter={onHighlight}
        onClick={onSelect}
      >
        {children}
      </button>
    </li>
  );
}
