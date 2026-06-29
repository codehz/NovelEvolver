export const DEFAULT_SCROLLBAR_HIDE_DELAY_MS = 400;
export const DEFAULT_MIN_THUMB_HEIGHT_PX = 24;

export type ScrollMetrics = {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
};

export type ScrollThumb = {
  thumbHeight: number;
  thumbOffset: number;
};

export function readScrollMetrics(viewport: HTMLElement): ScrollMetrics {
  return {
    clientHeight: viewport.clientHeight,
    scrollHeight: viewport.scrollHeight,
    scrollTop: viewport.scrollTop,
  };
}

export function computeScrollThumb(
  metrics: ScrollMetrics,
  minThumbHeightPx = DEFAULT_MIN_THUMB_HEIGHT_PX,
): ScrollThumb | null {
  const { clientHeight, scrollHeight, scrollTop } = metrics;
  if (scrollHeight <= clientHeight || clientHeight <= 0) {
    return null;
  }

  const maxScroll = scrollHeight - clientHeight;
  const thumbHeight = Math.max(minThumbHeightPx, (clientHeight / scrollHeight) * clientHeight);
  const trackRange = clientHeight - thumbHeight;
  const thumbOffset = maxScroll > 0 ? (scrollTop / maxScroll) * trackRange : 0;

  return { thumbHeight, thumbOffset };
}

export function scrollTopForThumbOffset(
  viewport: HTMLElement,
  thumb: ScrollThumb,
  thumbOffset: number,
): number {
  const maxScroll = viewport.scrollHeight - viewport.clientHeight;
  const trackRange = viewport.clientHeight - thumb.thumbHeight;
  const clamped = Math.min(Math.max(thumbOffset, 0), trackRange);
  const ratio = trackRange > 0 ? clamped / trackRange : 0;
  return ratio * maxScroll;
}

export function scrollTopForThumbDrag(
  viewport: HTMLElement,
  thumb: ScrollThumb,
  startScrollTop: number,
  startY: number,
  currentY: number,
): number {
  const maxScroll = viewport.scrollHeight - viewport.clientHeight;
  const trackRange = viewport.clientHeight - thumb.thumbHeight;
  if (trackRange <= 0 || maxScroll <= 0) {
    return startScrollTop;
  }

  const dragDeltaY = currentY - startY;
  const scrollDelta = (dragDeltaY / trackRange) * maxScroll;
  return startScrollTop + scrollDelta;
}
