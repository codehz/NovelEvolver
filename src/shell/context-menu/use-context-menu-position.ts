import { useLayoutEffect, useState, type RefObject } from "react";

const VIEWPORT_PAD = 8;

export type MenuAnchor = {
  x: number;
  y: number;
};

export type MenuPlacement = {
  left: number;
  top: number;
};

/**
 * Place a menu panel near pointer coordinates, flipping when near viewport edges.
 */
export function computeMenuPlacement(
  anchor: MenuAnchor,
  size: { width: number; height: number },
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): MenuPlacement {
  const { width, height } = size;
  let left = anchor.x;
  let top = anchor.y;

  if (left + width > viewport.width - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, anchor.x - width);
  }
  if (top + height > viewport.height - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.y - height);
  }
  left = Math.min(
    Math.max(VIEWPORT_PAD, left),
    Math.max(VIEWPORT_PAD, viewport.width - width - VIEWPORT_PAD),
  );
  top = Math.min(
    Math.max(VIEWPORT_PAD, top),
    Math.max(VIEWPORT_PAD, viewport.height - height - VIEWPORT_PAD),
  );
  return { left, top };
}

export function computeSubmenuPlacement(
  parentRect: DOMRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): MenuPlacement {
  const { width, height } = size;
  let left = parentRect.right - 2;
  if (left + width > viewport.width - VIEWPORT_PAD) {
    left = parentRect.left - width + 2;
  }
  let top = parentRect.top;
  if (top + height > viewport.height - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, viewport.height - height - VIEWPORT_PAD);
  }
  left = Math.min(
    Math.max(VIEWPORT_PAD, left),
    Math.max(VIEWPORT_PAD, viewport.width - width - VIEWPORT_PAD),
  );
  return { left, top };
}

export function useAnchoredMenuPlacement(
  panelRef: RefObject<HTMLElement | null>,
  anchor: MenuAnchor,
): MenuPlacement | null {
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel == null) {
      return;
    }
    const measure = () => {
      const rect = panel.getBoundingClientRect();
      setPlacement(computeMenuPlacement(anchor, { width: rect.width, height: rect.height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [anchor, panelRef]);

  return placement;
}
