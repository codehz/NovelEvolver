import { animate } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";

const contentHeightSpring = {
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

export function popoverOpenIsMeasurable(container: HTMLElement): boolean {
  return container.matches(":popover-open");
}

export function alwaysMeasurable(_container: HTMLElement): boolean {
  return true;
}

export type UseAnimatedContentHeightOptions = {
  /** When measurement and height updates are allowed. Defaults to `:popover-open` on `container`. */
  isMeasurable?: (container: HTMLElement) => boolean;
  /** Remeasure when the container fires `toggle` with `newState === "open"`. Default `true`. */
  remeasureOnContainerToggle?: boolean;
};

export function useAnimatedContentHeight(
  contentRef: RefObject<HTMLElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  options?: UseAnimatedContentHeightOptions,
): {
  heightPx: number | undefined;
  isHeightAnimating: boolean;
} {
  const [heightPx, setHeightPx] = useState<number | undefined>(undefined);
  const [isHeightAnimating, setIsHeightAnimating] = useState(false);
  const displayedHeightRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const isMeasurable = options?.isMeasurable ?? popoverOpenIsMeasurable;
  const remeasureOnContainerToggle = options?.remeasureOnContainerToggle ?? true;

  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (content == null || container == null) {
      return;
    }

    const isContainerMeasurable = () => isMeasurable(container);

    const applyHeight = (next: number) => {
      displayedHeightRef.current = next;
      setHeightPx(next);
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
        setIsHeightAnimating(false);
        return;
      }

      animationRef.current?.stop();
      setIsHeightAnimating(true);
      animationRef.current = animate(displayedHeightRef.current, target, {
        ...contentHeightSpring,
        onUpdate: (value) => {
          applyHeight(value);
        },
        onComplete: () => {
          applyHeight(target);
          animationRef.current = null;
          setIsHeightAnimating(false);
        },
      });
    };

    const remeasure = () => {
      if (!isContainerMeasurable()) {
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
    if (remeasureOnContainerToggle) {
      container.addEventListener("toggle", onToggle);
    }
    remeasure();

    return () => {
      if (remeasureOnContainerToggle) {
        container.removeEventListener("toggle", onToggle);
      }
      observer.disconnect();
      animationRef.current?.stop();
      animationRef.current = null;
      setIsHeightAnimating(false);
    };
  }, [contentRef, containerRef, isMeasurable, remeasureOnContainerToggle]);

  return { heightPx, isHeightAnimating };
}
