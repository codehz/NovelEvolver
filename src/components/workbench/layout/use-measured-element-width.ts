import { useEffect, useRef, useState } from "react";

export function useMeasuredElementWidth<TElement extends HTMLElement>(initialWidth: number) {
  const elementRef = useRef<TElement | null>(null);
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    setWidth(element.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setWidth(Math.round(entry.contentRect.width));
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
