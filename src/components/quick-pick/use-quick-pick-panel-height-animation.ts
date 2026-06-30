import { animate } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";

const panelHeightSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};

export function useQuickPickPanelHeightAnimation(contentRef: RefObject<HTMLElement | null>): {
  shellHeightPx: number | undefined;
} {
  const [shellHeightPx, setShellHeightPx] = useState<number | undefined>(undefined);
  const displayedHeightRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (content == null) {
      return;
    }

    const measureTargetHeight = () => Math.ceil(content.getBoundingClientRect().height);

    const applyHeight = (next: number) => {
      displayedHeightRef.current = next;
      setShellHeightPx(next);
    };

    const animateTo = (target: number) => {
      console.log("animateTo", target);
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        applyHeight(target);
        return;
      }

      if (Math.abs(target - displayedHeightRef.current) < 0.5) {
        applyHeight(target);
        return;
      }

      animationRef.current?.stop();
      animationRef.current = animate(displayedHeightRef.current, target, {
        ...panelHeightSpring,
        onUpdate: (value) => {
          applyHeight(value);
        },
        onComplete: () => {
          applyHeight(target);
          animationRef.current = null;
        },
      });
    };

    const onResize = () => {
      animateTo(measureTargetHeight());
    };

    const observer = new ResizeObserver(() => {
      onResize();
    });

    observer.observe(content);
    onResize();

    return () => {
      observer.disconnect();
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, [contentRef]);

  return { shellHeightPx };
}
