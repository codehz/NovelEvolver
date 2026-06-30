import { animate } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";

const panelHeightSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};

const MIN_MEASURED_HEIGHT_PX = 1;

function measureContentHeight(content: HTMLElement): number {
  const boxHeight = content.getBoundingClientRect().height;
  const scrollHeight = content.scrollHeight;
  return Math.ceil(Math.max(boxHeight, scrollHeight));
}

export function useQuickPickPanelHeightAnimation(
  contentRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
): {
  shellHeightPx: number | undefined;
} {
  const [shellHeightPx, setShellHeightPx] = useState<number | undefined>(undefined);
  const displayedHeightRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    const panel = panelRef.current;
    if (content == null || panel == null) {
      return;
    }

    const isPanelMeasurable = () => panel.matches(":popover-open");

    const applyHeight = (next: number) => {
      displayedHeightRef.current = next;
      setShellHeightPx(next);
    };

    const animateTo = (target: number) => {
      if (!hasInitializedRef.current) {
        if (target < MIN_MEASURED_HEIGHT_PX) {
          return;
        }
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

    const remeasure = () => {
      if (!isPanelMeasurable()) {
        return;
      }
      animateTo(measureContentHeight(content));
    };

    const observer = new ResizeObserver(() => {
      remeasure();
    });

    const onToggle = (event: ToggleEvent) => {
      if (event.newState === "open") {
        requestAnimationFrame(() => {
          remeasure();
        });
      }
    };

    observer.observe(content);
    panel.addEventListener("toggle", onToggle);
    remeasure();

    return () => {
      panel.removeEventListener("toggle", onToggle);
      observer.disconnect();
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, [contentRef, panelRef]);

  return { shellHeightPx };
}
