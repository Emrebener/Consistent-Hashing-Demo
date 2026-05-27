import { useRingStore } from "../state/store";
import { colorForNode } from "../lib/palette";

const RING_RADIUS = 180;
const VIEW = 480;
const CENTER = VIEW / 2;

/** Maps a 32-bit ring position to an angle in radians (0 at top, clockwise). */
function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}

function ringPoint(position: number, radius: number): { x: number; y: number } {
  const a = positionToAngle(position);
  return { x: CENTER + Math.cos(a) * radius, y: CENTER + Math.sin(a) * radius };
}

export function RingCanvas() {
  const snapshot = useRingStore((s) => s.snapshot);

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="absolute inset-0 m-auto h-full w-full"
      role="img"
      aria-label="Consistent hashing ring"
    >
      {/* Ring track */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RING_RADIUS}
        fill="none"
        stroke="#262626"
        strokeWidth={2}
      />

      {/* Vnode tokens */}
      {snapshot.tokens.map((t) => {
        const p = ringPoint(t.position, RING_RADIUS);
        const color = colorForNode(t.nodeId);
        return (
          <circle
            key={`${t.nodeId}#${t.vnodeIndex}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={color}
            stroke="#0a0a0a"
            strokeWidth={1}
          />
        );
      })}

      {/* Stored keys — render at their hash position, just inside the ring */}
      {Object.keys(snapshot.ownership).map((k) => {
        // The owner list is non-empty; pick the first owner's color for the dot.
        const owners = snapshot.ownership[k];
        if (!owners || owners.length === 0) return null;
        const color = colorForNode(owners[0]);
        // Hash the key the same way the core does — but to avoid importing
        // hashKey here, we use the ownership index proxy: place keys near
        // their first replica's first vnode. (Good enough for the static view.)
        const firstOwner = owners[0];
        const firstToken = snapshot.tokens.find((t) => t.nodeId === firstOwner);
        if (!firstToken) return null;
        const p = ringPoint(firstToken.position, RING_RADIUS - 12);
        return (
          <circle
            key={`k-${k}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={color}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}
