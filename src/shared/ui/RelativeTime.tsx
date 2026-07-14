import { useRetimer } from "foxact/use-retimer";
import { type ComponentPropsWithRef, useEffect, useState } from "react";

import {
  formatAbsoluteTime,
  formatRelativeTime,
  getNextRelativeTimeUpdateDelay,
} from "#app/shared/lib/ui/format-relative-time";

const MIN_UPDATE_DELAY_MS = 250;

type RelativeTimeProps = Omit<ComponentPropsWithRef<"time">, "children" | "dateTime"> & {
  timestampMs: number;
};

/**
 * Relative activity time that reschedules its next paint only when the label
 * would change. Timers are swapped via foxact `useRetimer` to avoid leaks.
 */
export function RelativeTime({ timestampMs, title, ...props }: RelativeTimeProps) {
  const retime = useRetimer();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const refreshFrom = (fromMs: number) => {
      setNowMs(fromMs);
      const delay = getNextRelativeTimeUpdateDelay(timestampMs, fromMs);
      if (delay == null) {
        retime();
        return;
      }
      retime(
        window.setTimeout(
          () => {
            refreshFrom(Date.now());
          },
          Math.max(delay, MIN_UPDATE_DELAY_MS),
        ),
      );
    };

    refreshFrom(Date.now());
    return () => {
      retime();
    };
  }, [timestampMs, retime]);

  const absolute = formatAbsoluteTime(timestampMs);

  return (
    <time dateTime={new Date(timestampMs).toISOString()} title={title ?? absolute} {...props}>
      {formatRelativeTime(timestampMs, nowMs)}
    </time>
  );
}
