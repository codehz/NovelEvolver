import { useLayoutEffect, type RefObject } from "react";

const HIGHLIGHT_REGISTRY_NAME = "novel-search-hit";

type HighlightNeedle = { kind: "literal"; value: string } | { kind: "regex"; pattern: RegExp };

function compileHighlightNeedle(query: string, isRegex: boolean): HighlightNeedle | null {
  const trimmed = query.trim();
  if (trimmed === "") {
    return null;
  }
  if (!isRegex) {
    return { kind: "literal", value: trimmed.toLowerCase() };
  }
  try {
    return { kind: "regex", pattern: new RegExp(trimmed, "giu") };
  } catch {
    return null;
  }
}

function collectRangesInElement(element: HTMLElement, needle: HighlightNeedle): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

  let textNode = walker.nextNode();
  while (textNode !== null) {
    const data = textNode.textContent ?? "";
    if (needle.kind === "literal") {
      let start = 0;
      while (start < data.length) {
        const index = data.toLowerCase().indexOf(needle.value, start);
        if (index === -1) {
          break;
        }
        const range = new Range();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + needle.value.length);
        ranges.push(range);
        start = index + needle.value.length;
      }
    } else {
      needle.pattern.lastIndex = 0;
      let match = needle.pattern.exec(data);
      while (match !== null) {
        if (match[0].length === 0) {
          // 避免零宽匹配导致死循环。
          needle.pattern.lastIndex = match.index + 1;
          match = needle.pattern.exec(data);
          continue;
        }
        const range = new Range();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, match.index + match[0].length);
        ranges.push(range);
        match = needle.pattern.exec(data);
      }
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
  isRegex: boolean,
  layoutRevision: string,
): void {
  useLayoutEffect(() => {
    if (!supportsCssHighlightApi()) {
      return;
    }

    const root = containerRef.current;
    const needle = compileHighlightNeedle(query, isRegex);
    if (root === null || needle === null) {
      CSS.highlights.delete(HIGHLIGHT_REGISTRY_NAME);
      return;
    }

    let frameId = 0;

    const applyHighlights = () => {
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
    };

    const scheduleApplyHighlights = () => {
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        applyHighlights();
      });
    };

    applyHighlights();

    const observer = new MutationObserver(() => {
      scheduleApplyHighlights();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
      CSS.highlights.delete(HIGHLIGHT_REGISTRY_NAME);
    };
  }, [containerRef, isRegex, layoutRevision, query]);
}

export { HIGHLIGHT_REGISTRY_NAME };
