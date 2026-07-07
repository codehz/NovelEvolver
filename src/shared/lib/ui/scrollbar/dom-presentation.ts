import type { ScrollThumb } from "./metrics";
import { scrollbarThumbClassName } from "./presentation";
import type { ScrollbarControllerSnapshot } from "./scrollbar-controller";

export function applyScrollbarThumbElement(
  thumb: HTMLElement,
  snapshot: ScrollbarControllerSnapshot,
  thumbMetrics: ScrollThumb,
): void {
  thumb.style.height = `${thumbMetrics.thumbHeight}px`;
  thumb.style.transform = `translateY(${thumbMetrics.thumbOffset}px)`;
  thumb.className = scrollbarThumbClassName(snapshot);
}
