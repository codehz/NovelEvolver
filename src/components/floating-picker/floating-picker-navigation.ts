import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

export const FLOATING_PICKER_OPTION_INDEX_ATTR = "data-floating-picker-index";

export function moveFloatingPickerHighlight(
  current: number,
  delta: number,
  length: number,
): number {
  if (length === 0) {
    return -1;
  }
  if (current < 0) {
    return delta > 0 ? 0 : length - 1;
  }
  return (current + delta + length) % length;
}

export type UseFloatingPickerNavigationOptions = {
  itemCount: number;
  open: boolean;
  onActivate: (index: number) => void;
};

export type UseFloatingPickerNavigationResult = {
  highlightIndex: number;
  setHighlightIndex: (index: number | ((current: number) => number)) => void;
  listRef: RefObject<HTMLUListElement | null>;
  onInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  resetHighlight: () => void;
};

export function useFloatingPickerNavigation({
  itemCount,
  open,
  onActivate,
}: UseFloatingPickerNavigationOptions): UseFloatingPickerNavigationResult {
  const listRef = useRef<HTMLUListElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const resetHighlight = useCallback(() => {
    setHighlightIndex(0);
  }, []);

  useEffect(() => {
    setHighlightIndex((index) => {
      if (itemCount === 0) {
        return -1;
      }
      if (index < 0 || index >= itemCount) {
        return 0;
      }
      return index;
    });
  }, [itemCount]);

  useEffect(() => {
    if (!open || highlightIndex < 0) {
      return;
    }
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(
      `[${FLOATING_PICKER_OPTION_INDEX_ATTR}="${highlightIndex}"]`,
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  const onInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIndex((index) => moveFloatingPickerHighlight(index, 1, itemCount));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((index) => moveFloatingPickerHighlight(index, -1, itemCount));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < itemCount) {
          onActivate(highlightIndex);
        }
      }
    },
    [highlightIndex, itemCount, onActivate],
  );

  return {
    highlightIndex,
    setHighlightIndex,
    listRef,
    onInputKeyDown,
    resetHighlight,
  };
}
