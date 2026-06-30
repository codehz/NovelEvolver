import {
  computeScrollThumb,
  DEFAULT_MIN_THUMB_HEIGHT_PX,
  DEFAULT_SCROLLBAR_HIDE_DELAY_MS,
  readScrollMetrics,
  scrollTopForThumbDrag,
  scrollTopForThumbOffset,
  type ScrollMetrics,
  type ScrollThumb,
} from "./metrics";

export type ScrollbarControllerOptions = {
  viewport: HTMLElement;
  /** Flex-sized scrollport root (parent of viewport); observed when ResizeObserver misses inline height animation on ancestors. */
  scrollHost?: HTMLElement | null;
  hideDelayMs?: number;
  minThumbHeightPx?: number;
  onChange: () => void;
};

export type ScrollbarControllerSnapshot = {
  metrics: ScrollMetrics | null;
  thumb: ScrollThumb | null;
  areaHover: boolean;
  thumbHover: boolean;
  dragging: boolean;
  scrollbarPeek: boolean;
  thumbShown: boolean;
  thumbActive: boolean;
};

type DragState = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
};

/**
 * Framework-agnostic scrollbar interaction for a scrollable viewport.
 * Owns metrics, peek/hide timing, and thumb/track pointer handling.
 */
export class ScrollbarController {
  private readonly viewport: HTMLElement;
  private readonly hideDelayMs: number;
  private readonly minThumbHeightPx: number;
  private readonly onChange: () => void;

  private metrics: ScrollMetrics | null = null;
  private areaHover = false;
  private thumbHover = false;
  private dragging = false;
  private scrollbarPeek = false;
  private dragState: DragState | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private documentDragListenersActive = false;
  private shellHeightAnimating = false;

  private readonly onViewportScroll = () => {
    this.refreshMetrics();
    this.showScrollbarPeek();
  };

  private readonly onDocumentPointerMove = (event: PointerEvent) => {
    this.onThumbPointerMove(event);
  };

  private readonly onDocumentPointerEnd = (event: PointerEvent) => {
    this.endThumbDrag(event);
  };

  constructor(options: ScrollbarControllerOptions) {
    this.viewport = options.viewport;
    this.hideDelayMs = options.hideDelayMs ?? DEFAULT_SCROLLBAR_HIDE_DELAY_MS;
    this.minThumbHeightPx = options.minThumbHeightPx ?? DEFAULT_MIN_THUMB_HEIGHT_PX;
    this.onChange = options.onChange;

    this.viewport.addEventListener("scroll", this.onViewportScroll, { passive: true });

    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.shellHeightAnimating) {
          return;
        }
        this.refreshMetrics();
      });
      this.resizeObserver.observe(this.viewport);
      const scrollHost = options.scrollHost;
      if (scrollHost instanceof HTMLElement) {
        this.resizeObserver.observe(scrollHost);
      }
      const scrollContent = this.viewport.firstElementChild;
      if (scrollContent instanceof HTMLElement) {
        this.resizeObserver.observe(scrollContent);
      }
    }

    this.metrics = readScrollMetrics(this.viewport);
  }

  destroy(): void {
    this.detachDocumentDragListeners();
    this.viewport.removeEventListener("scroll", this.onViewportScroll);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  getSnapshot(): ScrollbarControllerSnapshot {
    if (this.shellHeightAnimating) {
      return {
        metrics: this.metrics,
        thumb: null,
        areaHover: this.areaHover,
        thumbHover: false,
        dragging: this.dragging,
        scrollbarPeek: false,
        thumbShown: false,
        thumbActive: false,
      };
    }

    const thumb = this.metrics ? computeScrollThumb(this.metrics, this.minThumbHeightPx) : null;
    const thumbShown = Boolean(thumb && (this.areaHover || this.dragging || this.scrollbarPeek));
    const thumbActive = this.dragging || this.thumbHover;

    return {
      metrics: this.metrics,
      thumb,
      areaHover: this.areaHover,
      thumbHover: this.thumbHover,
      dragging: this.dragging,
      scrollbarPeek: this.scrollbarPeek,
      thumbShown,
      thumbActive,
    };
  }

  setShellHeightAnimating(active: boolean): void {
    if (this.shellHeightAnimating === active) {
      return;
    }
    this.shellHeightAnimating = active;
    if (!active) {
      this.refreshMetrics();
      return;
    }
    this.onChange();
  }

  refreshMetrics(): void {
    if (this.shellHeightAnimating) {
      return;
    }
    this.metrics = readScrollMetrics(this.viewport);
    this.onChange();
  }

  onAreaPointerEnter(): void {
    this.areaHover = true;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.onChange();
  }

  onAreaPointerLeave(): void {
    this.areaHover = false;
    this.thumbHover = false;
    if (!this.dragState) {
      this.scheduleHide();
    }
    this.onChange();
  }

  onThumbPointerEnter(): void {
    this.thumbHover = true;
    this.onChange();
  }

  onThumbPointerLeave(): void {
    this.thumbHover = false;
    this.onChange();
  }

  onTrackPointerDown(event: PointerEvent): void {
    const thumb = this.getThumb();
    if (!thumb || event.target !== event.currentTarget) {
      return;
    }

    const track = event.currentTarget as HTMLElement;
    const trackRect = track.getBoundingClientRect();
    const clickOffset = event.clientY - trackRect.top;
    const nextOffset = clickOffset - thumb.thumbHeight / 2;
    this.viewport.scrollTop = scrollTopForThumbOffset(this.viewport, thumb, nextOffset);
    this.showScrollbarPeek();
  }

  onThumbPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: this.viewport.scrollTop,
    };
    this.dragging = true;
    this.scrollbarPeek = true;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.attachDocumentDragListeners();
    this.onChange();
  }

  onThumbPointerMove(event: PointerEvent): void {
    const drag = this.dragState;
    const thumb = this.getThumb();
    if (!drag || !thumb || event.pointerId !== drag.pointerId) {
      return;
    }

    this.viewport.scrollTop = scrollTopForThumbDrag(
      this.viewport,
      thumb,
      drag.startScrollTop,
      drag.startY,
      event.clientY,
    );
    this.refreshMetrics();
  }

  endThumbDrag(event: PointerEvent): void {
    const drag = this.dragState;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    this.detachDocumentDragListeners();
    this.dragState = null;
    this.dragging = false;
    if (!this.areaHover) {
      this.scheduleHide();
    }
    this.onChange();
  }

  private attachDocumentDragListeners(): void {
    if (this.documentDragListenersActive) {
      return;
    }
    document.addEventListener("pointermove", this.onDocumentPointerMove);
    document.addEventListener("pointerup", this.onDocumentPointerEnd);
    document.addEventListener("pointercancel", this.onDocumentPointerEnd);
    this.documentDragListenersActive = true;
  }

  private detachDocumentDragListeners(): void {
    if (!this.documentDragListenersActive) {
      return;
    }
    document.removeEventListener("pointermove", this.onDocumentPointerMove);
    document.removeEventListener("pointerup", this.onDocumentPointerEnd);
    document.removeEventListener("pointercancel", this.onDocumentPointerEnd);
    this.documentDragListenersActive = false;
  }

  private getThumb(): ScrollThumb | null {
    if (!this.metrics) {
      return null;
    }
    return computeScrollThumb(this.metrics, this.minThumbHeightPx);
  }

  private showScrollbarPeek(): void {
    this.scrollbarPeek = true;
    this.scheduleHide();
    this.onChange();
  }

  private scheduleHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
    this.hideTimer = setTimeout(() => {
      this.scrollbarPeek = false;
      this.hideTimer = null;
      this.onChange();
    }, this.hideDelayMs);
  }
}
