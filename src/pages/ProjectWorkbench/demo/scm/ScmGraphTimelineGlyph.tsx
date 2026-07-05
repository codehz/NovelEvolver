import { cn } from "#app/lib/cn";

const glyphRootClass = cn("block h-full w-4 overflow-visible");
const connectorGroupClass = cn("text-ctp-surface1");
const nodeClass = cn("fill-current text-ctp-overlay0");
const headNodeClass = cn("fill-current text-ctp-mauve");
const headRingClass = cn("fill-none stroke-current text-ctp-mauve/30");

const GLYPH_WIDTH = 16;
const GLYPH_HEIGHT = 40;
const GLYPH_CENTER_X = 8;
const GLYPH_NODE_CENTER_Y = 12;
const NODE_RADIUS = 3;
const HEAD_NODE_RADIUS = 3.5;
const HEAD_RING_RADIUS = 5.5;

export function ScmGraphTimelineGlyph({
  isHead,
  showTopConnector,
  showBottomConnector,
}: {
  isHead: boolean;
  showTopConnector: boolean;
  showBottomConnector: boolean;
}) {
  const connectorGap = isHead ? HEAD_RING_RADIUS : NODE_RADIUS;

  return (
    <svg
      aria-hidden="true"
      className={glyphRootClass}
      focusable="false"
      preserveAspectRatio="none"
      viewBox={`0 0 ${GLYPH_WIDTH} ${GLYPH_HEIGHT}`}
    >
      <g className={connectorGroupClass}>
        {showTopConnector ? (
          <line
            stroke="currentColor"
            strokeWidth="1.5"
            x1={GLYPH_CENTER_X}
            x2={GLYPH_CENTER_X}
            y1="0"
            y2={GLYPH_NODE_CENTER_Y - connectorGap}
          />
        ) : null}
        {showBottomConnector ? (
          <line
            stroke="currentColor"
            strokeWidth="1.5"
            x1={GLYPH_CENTER_X}
            x2={GLYPH_CENTER_X}
            y1={GLYPH_NODE_CENTER_Y + connectorGap}
            y2={GLYPH_HEIGHT}
          />
        ) : null}
      </g>
      {isHead ? (
        <>
          <circle
            className={headRingClass}
            cx={GLYPH_CENTER_X}
            cy={GLYPH_NODE_CENTER_Y}
            r={HEAD_RING_RADIUS}
            strokeWidth="2"
          />
          <circle
            className={headNodeClass}
            cx={GLYPH_CENTER_X}
            cy={GLYPH_NODE_CENTER_Y}
            r={HEAD_NODE_RADIUS}
          />
        </>
      ) : (
        <circle
          className={nodeClass}
          cx={GLYPH_CENTER_X}
          cy={GLYPH_NODE_CENTER_Y}
          r={NODE_RADIUS}
        />
      )}
    </svg>
  );
}
