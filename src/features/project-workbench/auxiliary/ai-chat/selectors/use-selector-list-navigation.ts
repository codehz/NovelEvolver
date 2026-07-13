import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

export const SELECTOR_OPTION_INDEX_ATTR = "data-ai-chat-selector-option-index";

function moveHighlight(current: number, delta: number, length: number): number {
  if (length === 0) {
    return -1;
  }
  if (current < 0) {
    return delta > 0 ? 0 : length - 1;
  }
  return (current + delta + length) % length;
}

export function useSelectorListNavigation(options: {
  itemCount: number;
  onActivate: (index: number) => void;
}): {
  highlightIndex: number;
  setHighlightIndex: (index: number | ((current: number) => number)) => void;
  listRef: RefObject<HTMLUListElement | null>;
  onSearchKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  resetHighlight: () => void;
} {
  const { itemCount, onActivate } = options;
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
    if (highlightIndex < 0) {
      return;
    }
    const option = listRef.current?.querySelector<HTMLElement>(
      `[${SELECTOR_OPTION_INDEX_ATTR}="${highlightIndex}"]`,
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const onSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightIndex((index) => moveHighlight(index, 1, itemCount));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightIndex((index) => moveHighlight(index, -1, itemCount));
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
    onSearchKeyDown,
    resetHighlight,
  };
}
