import { cn } from "#app/shared/lib/ui/cn";

/**
 * Timeline rail for a commit row.
 *
 * Node is a fixed-size circle pinned near the top of the row (header band).
 * Connectors are independent CSS lines that can stretch the full row height
 * (including expanded children) without distorting the node.
 */
const railClass = cn("pointer-events-none absolute inset-y-0 left-2 w-4");
const connectorClass = cn("absolute left-1/2 w-px -translate-x-1/2 bg-ctp-surface1");
const nodeClass = cn(
  "absolute left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ctp-overlay0",
);
const headNodeClass = cn(
  "absolute left-1/2 size-1.75 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ctp-mauve",
);
const headRingClass = cn(
  "absolute left-1/2 size-2.75 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ctp-mauve/30",
);

/** Vertical center of the node within the fixed header band (matches previous SVG y=12 in 40px). */
const NODE_CENTER_Y_PX = 12;
const NODE_RADIUS_PX = 3;
const HEAD_RING_RADIUS_PX = 5.5;

type HistoryGraphGlyphProps = {
  isHead: boolean;
  showTopConnector: boolean;
  showBottomConnector: boolean;
};

export function HistoryGraphGlyph({
  isHead,
  showTopConnector,
  showBottomConnector,
}: HistoryGraphGlyphProps) {
  const gap = isHead ? HEAD_RING_RADIUS_PX : NODE_RADIUS_PX;

  return (
    <div aria-hidden="true" className={railClass}>
      {showTopConnector ? (
        <div
          className={connectorClass}
          style={{ top: 0, height: Math.max(0, NODE_CENTER_Y_PX - gap) }}
        />
      ) : null}
      {showBottomConnector ? (
        <div className={connectorClass} style={{ top: NODE_CENTER_Y_PX + gap, bottom: 0 }} />
      ) : null}
      {isHead ? (
        <>
          <div className={headRingClass} style={{ top: NODE_CENTER_Y_PX }} />
          <div className={headNodeClass} style={{ top: NODE_CENTER_Y_PX }} />
        </>
      ) : (
        <div className={nodeClass} style={{ top: NODE_CENTER_Y_PX }} />
      )}
    </div>
  );
}
