import { useLayoutEffect, useRef, useState } from "react";

export function useMeasuredElementWidth<TElement extends HTMLElement>(initialWidth: number) {
  const elementRef = useRef<TElement | null>(null);
  const [width, setWidth] = useState(initialWidth);

  // Measure before paint so the first frame already uses the real container width.
  // useEffect would paint the initial estimate first, then animate sidebar spacers.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const applyWidth = (nextWidth: number) => {
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    // clientWidth is already an integer content+padding width; keep RO on the same basis.
    applyWidth(element.clientWidth);

    const observer = new ResizeObserver(() => {
      // Prefer clientWidth over contentRect so padding/border box stays consistent
      // with the initial layout-effect read (avoids a 1px post-paint correction).
      applyWidth(element.clientWidth);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    ref: elementRef,
    width,
  };
}
