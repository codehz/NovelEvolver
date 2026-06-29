import type { CSSProperties, PointerEvent } from "react";

import type { ScrollMetrics, ScrollThumb } from "./metrics";
import { scrollbarThumbClassName, scrollbarTrackClass } from "./presentation";
import type { ScrollbarControllerSnapshot } from "./scrollbar-controller";

export type ScrollbarThumbTrackProps = {
  snapshot: ScrollbarControllerSnapshot;
  metrics: ScrollMetrics;
  thumb: ScrollThumb;
  trackStyle?: CSSProperties;
  onTrackPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onThumbPointerEnter: () => void;
  onThumbPointerLeave: () => void;
  onThumbPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
};

export function ScrollbarThumbTrack({
  snapshot,
  metrics,
  thumb,
  trackStyle,
  onTrackPointerDown,
  onThumbPointerEnter,
  onThumbPointerLeave,
  onThumbPointerDown,
}: ScrollbarThumbTrackProps) {
  return (
    <div
      className={scrollbarTrackClass}
      style={{ height: metrics.clientHeight, ...trackStyle }}
      onPointerDown={onTrackPointerDown}
    >
      <div
        className={scrollbarThumbClassName(snapshot)}
        style={{
          height: thumb.thumbHeight,
          transform: `translateY(${thumb.thumbOffset}px)`,
        }}
        onMouseEnter={onThumbPointerEnter}
        onMouseLeave={onThumbPointerLeave}
        onPointerDown={onThumbPointerDown}
      />
    </div>
  );
}
