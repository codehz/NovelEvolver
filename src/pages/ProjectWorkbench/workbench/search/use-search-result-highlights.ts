import { useLayoutEffect, type RefObject } from "react";

const HIGHLIGHT_REGISTRY_NAME = "novel-search-hit";

function normalizeNeedle(query: string): string {
  return query.trim().toLowerCase();
}

function collectRangesInElement(element: HTMLElement, needle: string): Range[] {
  if (needle === "") {
    return [];
  }

  const ranges: Range[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

  let textNode = walker.nextNode();
  while (textNode !== null) {
    const data = textNode.textContent ?? "";
    let start = 0;
    while (start < data.length) {
      const index = data.toLowerCase().indexOf(needle, start);
      if (index === -1) {
        break;
      }
      const range = new Range();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + needle.length);
      ranges.push(range);
      start = index + needle.length;
    }
    textNode = walker.nextNode();
  }

  return ranges;
}

function supportsCssHighlightApi(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

/**
 * Registers CSS Highlight API ranges for all `[data-search-highlight]` descendants.
 */
export function useSearchResultHighlights(
  containerRef: RefObject<HTMLElement | null>,
  query: string,
  layoutRevision: string,
): void {
  const needle = normalizeNeedle(query);

  useLayoutEffect(() => {
    if (!supportsCssHighlightApi()) {
      return;
    }

    const root = containerRef.current;
    if (root === null || needle === "") {
      CSS.highlights.delete(HIGHLIGHT_REGISTRY_NAME);
      return;
    }

    const targets = root.querySelectorAll<HTMLElement>("[data-search-highlight]");
    const ranges: Range[] = [];
    for (const target of targets) {
      ranges.push(...collectRangesInElement(target, needle));
    }

    if (ranges.length === 0) {
      CSS.highlights.delete(HIGHLIGHT_REGISTRY_NAME);
      return;
    }

    CSS.highlights.set(HIGHLIGHT_REGISTRY_NAME, new Highlight(...ranges));

    return () => {
      CSS.highlights.delete(HIGHLIGHT_REGISTRY_NAME);
    };
  }, [containerRef, layoutRevision, needle, query]);
}

export { HIGHLIGHT_REGISTRY_NAME };
