/** Layout flow height at the section seam (handle is overlaid, not counted in flex). */
export const SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT = 0;
export const SIDEBAR_SECTION_HEADER_HEIGHT_PX = 24;
export const MIN_SIDEBAR_SECTION_BODY_HEIGHT = 72;

export type SidebarPaneGeometryInput = {
  id: string;
  expanded: boolean;
  defaultBodyHeight: number;
  minBodyHeight?: number;
};

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function scaleHeightsToTotal(heights: number[], total: number) {
  if (heights.length === 0) {
    return [];
  }

  if (total <= 0) {
    return heights.map(() => 0);
  }

  const currentTotal = sum(heights);
  if (currentTotal <= 0) {
    const evenShare = Math.floor(total / heights.length);
    const remainder = total - evenShare * heights.length;
    return heights.map((_, index) => evenShare + (index < remainder ? 1 : 0));
  }

  const scaled = heights.map((height) => (height * total) / currentTotal);
  const floors = scaled.map((value) => Math.floor(value));
  let remaining = total - sum(floors);

  const indexesByFraction = scaled
    .map((value, index) => ({ index, fraction: value - floors[index]! }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < indexesByFraction.length && remaining > 0; index += 1) {
    floors[indexesByFraction[index]!.index] += 1;
    remaining -= 1;
  }

  return floors;
}

export function resolveAvailableBodyHeight(
  containerHeight: number,
  paneCount: number,
  expandedCount: number,
) {
  return Math.max(
    containerHeight -
      paneCount * SIDEBAR_SECTION_HEADER_HEIGHT_PX -
      Math.max(expandedCount - 1, 0) * SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT,
    0,
  );
}

export function resolveEffectiveMinHeights(
  panes: SidebarPaneGeometryInput[],
  availableBodyHeight: number,
) {
  const minHeights = panes.map((pane) =>
    Math.max(
      MIN_SIDEBAR_SECTION_BODY_HEIGHT,
      pane.minBodyHeight ?? MIN_SIDEBAR_SECTION_BODY_HEIGHT,
    ),
  );
  const totalMinHeight = sum(minHeights);

  if (totalMinHeight <= availableBodyHeight) {
    return minHeights;
  }

  return scaleHeightsToTotal(minHeights, availableBodyHeight);
}

/**
 * Allocate body heights for expanded panes only.
 * Single expanded pane always consumes the full available budget.
 */
export function resolvePaneHeights(
  panes: SidebarPaneGeometryInput[],
  preferredHeights: Record<string, number>,
  availableBodyHeight: number,
) {
  if (panes.length === 0) {
    return {
      effectiveMinHeights: [] as number[],
      resolvedHeights: [] as number[],
    };
  }

  const effectiveMinHeights = resolveEffectiveMinHeights(panes, availableBodyHeight);

  if (panes.length === 1) {
    return {
      effectiveMinHeights,
      resolvedHeights: [Math.max(availableBodyHeight, 0)],
    };
  }

  let remainingBodyHeight = Math.max(availableBodyHeight, 0);
  const resolvedHeights = panes.map(() => 0);
  const minHeightSuffixSums = panes.map((_, paneIndex) =>
    sum(effectiveMinHeights.slice(paneIndex + 1)),
  );

  for (let paneIndex = 0; paneIndex < panes.length - 1; paneIndex += 1) {
    const pane = panes[paneIndex]!;
    const minHeight = effectiveMinHeights[paneIndex]!;
    const maxHeight = Math.max(minHeight, remainingBodyHeight - minHeightSuffixSums[paneIndex]!);
    const preferredHeight = Math.round(preferredHeights[pane.id] ?? pane.defaultBodyHeight);
    const resolvedHeight = Math.min(maxHeight, Math.max(minHeight, preferredHeight));

    resolvedHeights[paneIndex] = resolvedHeight;
    remainingBodyHeight -= resolvedHeight;
  }

  resolvedHeights[panes.length - 1] = Math.max(remainingBodyHeight, 0);

  return {
    effectiveMinHeights,
    resolvedHeights,
  };
}

/** Map every pane id → explicit body px (collapsed = 0). */
export function resolveDisplayHeights(
  panes: SidebarPaneGeometryInput[],
  preferredHeights: Record<string, number>,
  availableBodyHeight: number,
) {
  const expandedPanes = panes.filter((pane) => pane.expanded);
  const { effectiveMinHeights, resolvedHeights } = resolvePaneHeights(
    expandedPanes,
    preferredHeights,
    availableBodyHeight,
  );

  const displayHeights: Record<string, number> = {};
  for (const pane of panes) {
    displayHeights[pane.id] = 0;
  }
  expandedPanes.forEach((pane, paneIndex) => {
    displayHeights[pane.id] = resolvedHeights[paneIndex]!;
  });

  return {
    expandedPanes,
    effectiveMinHeights,
    resolvedHeights,
    displayHeights,
  };
}

export function applyResizeDelta(
  heights: number[],
  minHeights: number[],
  handleIndex: number,
  delta: number,
) {
  if (delta === 0) {
    return heights;
  }

  const nextHeights = [...heights];

  if (delta > 0) {
    const shrinkCapacity = sum(
      nextHeights.slice(handleIndex + 1).map((height, paneIndex) => {
        const minHeight = minHeights[handleIndex + 1 + paneIndex]!;
        return Math.max(height - minHeight, 0);
      }),
    );
    let remainingDelta = Math.min(delta, shrinkCapacity);

    nextHeights[handleIndex] += remainingDelta;

    for (
      let paneIndex = handleIndex + 1;
      paneIndex < nextHeights.length && remainingDelta > 0;
      paneIndex += 1
    ) {
      const shrinkAmount = Math.min(
        Math.max(nextHeights[paneIndex]! - minHeights[paneIndex]!, 0),
        remainingDelta,
      );
      nextHeights[paneIndex] -= shrinkAmount;
      remainingDelta -= shrinkAmount;
    }

    return nextHeights;
  }

  const growth = Math.abs(delta);
  const shrinkCapacity = sum(
    nextHeights
      .slice(0, handleIndex + 1)
      .map((height, paneIndex) => Math.max(height - minHeights[paneIndex]!, 0)),
  );
  let remainingDelta = Math.min(growth, shrinkCapacity);

  nextHeights[handleIndex + 1] += remainingDelta;

  for (let paneIndex = handleIndex; paneIndex >= 0 && remainingDelta > 0; paneIndex -= 1) {
    const shrinkAmount = Math.min(
      Math.max(nextHeights[paneIndex]! - minHeights[paneIndex]!, 0),
      remainingDelta,
    );
    nextHeights[paneIndex] -= shrinkAmount;
    remainingDelta -= shrinkAmount;
  }

  return nextHeights;
}

export function expandedSignature(panes: readonly { id: string; expanded: boolean }[]) {
  return panes.map((pane) => `${pane.id}:${pane.expanded ? "1" : "0"}`).join("|");
}
