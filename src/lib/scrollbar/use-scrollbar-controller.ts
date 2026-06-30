import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

import { ScrollbarController, type ScrollbarControllerSnapshot } from "./scrollbar-controller";

export type ScrollbarControllerBindings = {
  scrollHostRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  snapshot: ScrollbarControllerSnapshot | null;
  onAreaPointerEnter: () => void;
  onAreaPointerLeave: () => void;
  onTrackPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onThumbPointerEnter: () => void;
  onThumbPointerLeave: () => void;
  onThumbPointerDown: (event: PointerEvent<HTMLElement>) => void;
};

export type UseScrollbarControllerOptions = {
  /** While true, hides the custom thumb and pauses metric refresh until it becomes false. */
  shellHeightAnimating?: boolean;
};

export function useScrollbarController(
  options?: UseScrollbarControllerOptions,
): ScrollbarControllerBindings {
  const scrollHostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ScrollbarController | null>(null);
  const [, setRevision] = useState(0);
  const shellHeightAnimating = options?.shellHeightAnimating ?? false;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const controller = new ScrollbarController({
      viewport,
      scrollHost: scrollHostRef.current,
      onChange: () => {
        setRevision((n) => n + 1);
      },
    });
    controllerRef.current = controller;
    controller.refreshMetrics();

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    controllerRef.current?.setShellHeightAnimating(shellHeightAnimating);
  }, [shellHeightAnimating]);

  const snapshot = controllerRef.current?.getSnapshot() ?? null;

  return {
    scrollHostRef,
    viewportRef,
    snapshot,
    onAreaPointerEnter: () => {
      controllerRef.current?.onAreaPointerEnter();
    },
    onAreaPointerLeave: () => {
      controllerRef.current?.onAreaPointerLeave();
    },
    onTrackPointerDown: (event) => {
      controllerRef.current?.onTrackPointerDown(event.nativeEvent);
    },
    onThumbPointerEnter: () => {
      controllerRef.current?.onThumbPointerEnter();
    },
    onThumbPointerLeave: () => {
      controllerRef.current?.onThumbPointerLeave();
    },
    onThumbPointerDown: (event) => {
      controllerRef.current?.onThumbPointerDown(event.nativeEvent);
    },
  };
}
