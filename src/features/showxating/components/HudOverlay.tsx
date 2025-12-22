import { useShowxatingStore, DetectionStatus, Point } from '../store/showxatingStore';

interface HudOverlayProps {
  width: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
}

export function HudOverlay({ width, height, videoWidth, videoHeight }: HudOverlayProps) {
  const { detectionStatus, matchConfidence, detectedQuadrilateral } = useShowxatingStore();

  // Compute object-cover transformation
  // object-cover fills container while maintaining aspect ratio, cropping overflow
  const videoAR = (videoWidth || width) / (videoHeight || height);
  const containerAR = width / height;

  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (videoAR > containerAR) {
    // Video is wider - scale by height, crop sides
    scale = height / (videoHeight || height);
    const displayedVideoWidth = (videoWidth || width) * scale;
    offsetX = (displayedVideoWidth - width) / 2;
  } else {
    // Video is taller - scale by width, crop top/bottom
    scale = width / (videoWidth || width);
    const displayedVideoHeight = (videoHeight || height) * scale;
    offsetY = (displayedVideoHeight - height) / 2;
  }


  const cx = width / 2;
  const cy = height / 2;

  // Corner bracket size
  const bracketSize = Math.min(width, height) * 0.08;
  const bracketInset = 20;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Static corner brackets (frame) */}
      <CornerBrackets
        width={width}
        height={height}
        size={bracketSize}
        inset={bracketInset}
      />

      {/* Detected card brackets */}
      {detectedQuadrilateral && (
        <DetectedCardBrackets
          corners={detectedQuadrilateral}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          status={detectionStatus}
        />
      )}

      {/* Center crosshair */}
      <Crosshair cx={cx} cy={cy} size={40} status={detectionStatus} />

      {/* Status text */}
      <StatusText
        x={bracketInset + 10}
        y={bracketInset + 30}
        status={detectionStatus}
      />

      {/* Confidence indicator */}
      {detectionStatus !== 'searching' && (
        <ConfidenceBar
          x={width - bracketInset - 100}
          y={bracketInset + 20}
          confidence={matchConfidence}
        />
      )}

      {/* Bottom status bar */}
      <BottomStatus
        x={bracketInset + 10}
        y={height - bracketInset - 10}
        status={detectionStatus}
      />
    </svg>
  );
}

// Corner brackets component
function CornerBrackets({
  width,
  height,
  size,
  inset,
}: {
  width: number;
  height: number;
  size: number;
  inset: number;
}) {
  const corners = [
    // Top-left
    { x: inset, y: inset, dx: size, dy: 0, dx2: 0, dy2: size },
    // Top-right
    { x: width - inset, y: inset, dx: -size, dy: 0, dx2: 0, dy2: size },
    // Bottom-left
    { x: inset, y: height - inset, dx: size, dy: 0, dx2: 0, dy2: -size },
    // Bottom-right
    { x: width - inset, y: height - inset, dx: -size, dy: 0, dx2: 0, dy2: -size },
  ];

  return (
    <g className="hud-bracket">
      {corners.map((c, i) => (
        <path
          key={i}
          d={`M ${c.x + c.dx} ${c.y} L ${c.x} ${c.y} L ${c.x} ${c.y + c.dy2}`}
          strokeLinecap="square"
        />
      ))}
    </g>
  );
}

// Crosshair component
function Crosshair({
  cx,
  cy,
  size,
  status,
}: {
  cx: number;
  cy: number;
  size: number;
  status: DetectionStatus;
}) {
  const gap = 8;
  const tickSize = 6;

  // Animate crosshair based on status
  const opacity = status === 'searching' ? 0.5 : status === 'locked' ? 1 : 0.7;

  return (
    <g className="hud-crosshair" style={{ opacity }}>
      {/* Horizontal lines */}
      <line x1={cx - size} y1={cy} x2={cx - gap} y2={cy} />
      <line x1={cx + gap} y1={cy} x2={cx + size} y2={cy} />

      {/* Vertical lines */}
      <line x1={cx} y1={cy - size} x2={cx} y2={cy - gap} />
      <line x1={cx} y1={cy + gap} x2={cx} y2={cy + size} />

      {/* Center ticks */}
      <g className="hud-crosshair-center">
        <line x1={cx - tickSize} y1={cy} x2={cx + tickSize} y2={cy} />
        <line x1={cx} y1={cy - tickSize} x2={cx} y2={cy + tickSize} />
      </g>

      {/* Corner marks for locked state */}
      {status === 'locked' && (
        <g stroke="var(--showxating-cyan, #00d4ff)">
          <path d={`M ${cx - 20} ${cy - 20} l -10 0 l 0 10`} fill="none" />
          <path d={`M ${cx + 20} ${cy - 20} l 10 0 l 0 10`} fill="none" />
          <path d={`M ${cx - 20} ${cy + 20} l -10 0 l 0 -10`} fill="none" />
          <path d={`M ${cx + 20} ${cy + 20} l 10 0 l 0 -10`} fill="none" />
        </g>
      )}
    </g>
  );
}

// Status text component
function StatusText({
  x,
  y,
  status,
}: {
  x: number;
  y: number;
  status: DetectionStatus;
}) {
  const statusLabels: Record<DetectionStatus, string> = {
    searching: 'SEARCHING',
    tracking: 'TRACKING',
    locked: 'LOCK',
    lost: 'LOST',
  };

  const statusColors: Record<DetectionStatus, string> = {
    searching: 'var(--showxating-gold-dim, #a08040)',
    tracking: 'var(--showxating-gold, #d4a84b)',
    locked: 'var(--showxating-cyan, #00d4ff)',
    lost: 'var(--showxating-red, #ff3b3b)',
  };

  return (
    <g>
      <text
        x={x}
        y={y - 15}
        className="hud-text"
        fill="var(--showxating-gold-dim, #a08040)"
        fontSize="10"
      >
        STATUS
      </text>
      <text
        x={x}
        y={y}
        className="hud-text"
        fill={statusColors[status]}
        fontSize="14"
        fontWeight="600"
      >
        {statusLabels[status]}
      </text>
    </g>
  );
}

// Confidence bar component
function ConfidenceBar({
  x,
  y,
  confidence,
}: {
  x: number;
  y: number;
  confidence: number;
}) {
  const barWidth = 80;
  const barHeight = 6;
  const fillWidth = barWidth * Math.min(1, Math.max(0, confidence));

  return (
    <g>
      <text
        x={x}
        y={y - 8}
        className="hud-text"
        fill="var(--showxating-gold-dim, #a08040)"
        fontSize="10"
      >
        CONFIDENCE
      </text>
      {/* Background */}
      <rect
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        fill="rgba(212, 168, 75, 0.2)"
      />
      {/* Fill */}
      <rect
        x={x}
        y={y}
        width={fillWidth}
        height={barHeight}
        fill={confidence > 0.8 ? 'var(--showxating-cyan, #00d4ff)' : 'var(--showxating-gold, #d4a84b)'}
      />
      {/* Border */}
      <rect
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        fill="none"
        stroke="var(--showxating-gold-dim, #a08040)"
        strokeWidth="1"
      />
    </g>
  );
}

// Bottom status bar
function BottomStatus({
  x,
  y,
  status,
}: {
  x: number;
  y: number;
  status: DetectionStatus;
}) {
  const modeText = status === 'searching' ? 'SCAN MODE ACTIVE' : 'CARD DETECTED';

  return (
    <text
      x={x}
      y={y}
      className="hud-text"
      fill="var(--showxating-gold-dim, #a08040)"
      fontSize="10"
    >
      {modeText}
    </text>
  );
}

// Detected card brackets - drawn around the detected quadrilateral
function DetectedCardBrackets({
  corners,
  scale,
  offsetX,
  offsetY,
  status,
}: {
  corners: Point[];
  scale: number;
  offsetX: number;
  offsetY: number;
  status: DetectionStatus;
}) {
  // Transform video coordinates to display coordinates (accounting for object-cover)
  // displayX = (videoX * scale) - offsetX
  // displayY = (videoY * scale) - offsetY
  const scaled = corners.map(p => ({
    x: p.x * scale - offsetX,
    y: p.y * scale - offsetY,
  }));


  // Bracket size (smaller than frame brackets)
  const bracketSize = 30;

  // Color based on status - use hardcoded colors to ensure visibility
  const color = status === 'locked'
    ? '#00d4ff'
    : status === 'tracking'
    ? '#d4a84b'
    : '#a08040';

  // Draw corner brackets at each detected corner
  return (
    <g stroke={color} strokeWidth={status === 'locked' ? 3 : 2} fill="none">
      {scaled.map((corner, i) => {
        // Get adjacent corners for bracket direction
        const prev = scaled[(i + 3) % 4];
        const next = scaled[(i + 1) % 4];

        // Direction vectors (normalized)
        const toPrev = normalize({ x: prev.x - corner.x, y: prev.y - corner.y });
        const toNext = normalize({ x: next.x - corner.x, y: next.y - corner.y });

        // Bracket endpoints
        const p1 = {
          x: corner.x + toPrev.x * bracketSize,
          y: corner.y + toPrev.y * bracketSize,
        };
        const p2 = {
          x: corner.x + toNext.x * bracketSize,
          y: corner.y + toNext.y * bracketSize,
        };

        return (
          <path
            key={i}
            d={`M ${p1.x} ${p1.y} L ${corner.x} ${corner.y} L ${p2.x} ${p2.y}`}
            strokeLinecap="square"
          />
        );
      })}

      {/* Draw outline of detected card (subtle) */}
      {status === 'locked' && (
        <path
          d={`M ${scaled[0].x} ${scaled[0].y}
              L ${scaled[1].x} ${scaled[1].y}
              L ${scaled[2].x} ${scaled[2].y}
              L ${scaled[3].x} ${scaled[3].y} Z`}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.5}
        />
      )}

    </g>
  );
}

// Normalize a vector
function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
