import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRingStore } from "../state/store";
import { colorForNode } from "../lib/palette";
import { DURATION, scaledSeconds } from "../lib/animation";
import type { HashTrace } from "../core/events";
import { useHoverStore } from "../state/hover";
import { hashKey } from "../core/hash";

const RING_RADIUS = 180;
const VIEW = 480;
const CENTER = VIEW / 2;

function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}
function ringPoint(position: number, radius: number): { x: number; y: number } {
  const a = positionToAngle(position);
  return { x: CENTER + Math.cos(a) * radius, y: CENTER + Math.sin(a) * radius };
}

type Probe = { trace: HashTrace; spawnedAt: number };

export function RingCanvas() {
  const snapshot = useRingStore((s) => s.snapshot);
  const lastEvents = useRingStore((s) => s.lastEvents);
  const speed = useRingStore((s) => s.speed);
  const hoveredNodeId = useHoverStore((s) => s.hoveredNodeId);
  const hoveredKey = useHoverStore((s) => s.hoveredKey);
  const setHoveredKey = useHoverStore((s) => s.setHoveredKey);
  const hoveredToken = useHoverStore((s) => s.hoveredToken);
  const setHoveredToken = useHoverStore((s) => s.setHoveredToken);

  const [probe, setProbe] = useState<Probe | null>(null);

  // Spawn a probe when the most recent op is PUT or GET.
  useEffect(() => {
    for (let i = lastEvents.length - 1; i >= 0; i--) {
      const e = lastEvents[i];
      if (e.type === "KeyWritten" || e.type === "KeyRead") {
        setProbe({ trace: e.trace, spawnedAt: Date.now() });
        return;
      }
    }
  }, [lastEvents]);

  // Auto-clear the probe after the walk + drop completes.
  useEffect(() => {
    if (!probe) return;
    const totalMs =
      DURATION.calcFrame * 3 + // wait for frame 3 to land
      DURATION.probeWalkPerToken * Math.max(probe.trace.replicas.length, 1) * 4 +
      DURATION.keyDrop;
    const id = setTimeout(() => setProbe(null), totalMs / speed);
    return () => clearTimeout(id);
  }, [probe, speed]);

  const probePoint = probe ? ringPoint(probe.trace.position, RING_RADIUS) : null;

  // Keys hosted by the hovered vnode. A vnode hosts a key when it is the
  // closest-clockwise vnode of its physical node from the key's hash — and
  // that physical node is one of the key's RF replicas. This is exactly the
  // inverse of the key→vnode arcs the key-hover affordance draws.
  const keysClaimedByHoveredToken = new Set<string>();
  if (hoveredToken) {
    for (const k of Object.keys(snapshot.ownership)) {
      const owners = snapshot.ownership[k];
      if (!owners.includes(hoveredToken.nodeId)) continue;
      const h = hashKey(k);
      const candidates = snapshot.tokens.filter(
        (t) => t.nodeId === hoveredToken.nodeId
      );
      if (candidates.length === 0) continue;
      const best = candidates.reduce(
        (acc, t) => {
          const dist = (t.position - h + 2 ** 32) % 2 ** 32;
          return dist < acc.dist ? { t, dist } : acc;
        },
        {
          t: candidates[0],
          dist: (candidates[0].position - h + 2 ** 32) % 2 ** 32,
        }
      );
      if (best.t.vnodeIndex === hoveredToken.vnodeIndex) {
        keysClaimedByHoveredToken.add(k);
      }
    }
  }

  // Replica vnodes for the hovered key (closest-clockwise vnode per owner).
  const vnodesLitByHoveredKey = new Set<string>(); // `${nodeId}#${vnodeIndex}`
  if (hoveredKey && snapshot.ownership[hoveredKey]) {
    const keyHash = hashKey(hoveredKey);
    for (const ownerId of snapshot.ownership[hoveredKey]) {
      const candidates = snapshot.tokens.filter((t) => t.nodeId === ownerId);
      if (candidates.length === 0) continue;
      const best = candidates.reduce(
        (acc, t) => {
          const dist = (t.position - keyHash + 2 ** 32) % 2 ** 32;
          return dist < acc.dist ? { t, dist } : acc;
        },
        {
          t: candidates[0],
          dist: (candidates[0].position - keyHash + 2 ** 32) % 2 ** 32,
        }
      );
      vnodesLitByHoveredKey.add(`${best.t.nodeId}#${best.t.vnodeIndex}`);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="absolute inset-0 m-auto h-full w-full"
      role="img"
      aria-label="Consistent hashing ring"
    >
      <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} fill="none" stroke="#262626" strokeWidth={2} />

      {snapshot.tokens.map((t) => {
        const p = ringPoint(t.position, RING_RADIUS);
        const color = colorForNode(t.nodeId);
        const isReplica = probe?.trace.replicas.includes(t.nodeId) ?? false;
        const isHoveredNode = hoveredNodeId === t.nodeId;
        const isHoveredToken =
          hoveredToken?.nodeId === t.nodeId && hoveredToken?.vnodeIndex === t.vnodeIndex;
        const isLitByKey = vnodesLitByHoveredKey.has(`${t.nodeId}#${t.vnodeIndex}`);
        const radius = isHoveredToken
          ? 8
          : isLitByKey
            ? 7
            : isReplica || isHoveredNode
              ? 7
              : 4;
        const litStroke = isHoveredToken || isHoveredNode || isLitByKey;
        return (
          <motion.circle
            key={`${t.nodeId}#${t.vnodeIndex}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={color}
            stroke={litStroke ? "#ffffff" : "#0a0a0a"}
            strokeWidth={isHoveredToken ? 2 : litStroke ? 1.5 : 1}
            initial={{ r: 0 }}
            animate={{ r: radius }}
            transition={{ duration: 0.18 }}
            style={{ cursor: "pointer" }}
            onMouseEnter={() =>
              setHoveredToken({ nodeId: t.nodeId, vnodeIndex: t.vnodeIndex })
            }
            onMouseLeave={() => setHoveredToken(null)}
          />
        );
      })}

      {hoveredToken && (() => {
        const token = snapshot.tokens.find(
          (t) =>
            t.nodeId === hoveredToken.nodeId && t.vnodeIndex === hoveredToken.vnodeIndex
        );
        if (!token) return null;
        const tokenPt = ringPoint(token.position, RING_RADIUS);
        const labelAngle = positionToAngle(token.position);
        const labelPt = {
          x: CENTER + Math.cos(labelAngle) * (RING_RADIUS + 18),
          y: CENTER + Math.sin(labelAngle) * (RING_RADIUS + 18),
        };
        return (
          <g style={{ pointerEvents: "none" }}>
            {Array.from(keysClaimedByHoveredToken).map((key) => {
              const point = ringPoint(hashKey(key), RING_RADIUS - 12);
              return (
                <line
                  key={`claim-${key}`}
                  x1={tokenPt.x}
                  y1={tokenPt.y}
                  x2={point.x}
                  y2={point.y}
                  stroke="#ffffff"
                  strokeOpacity={0.55}
                  strokeWidth={1.2}
                />
              );
            })}
            <text
              x={labelPt.x}
              y={labelPt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="#ffffff"
            >
              {hoveredToken.nodeId} #{hoveredToken.vnodeIndex}
            </text>
          </g>
        );
      })()}

      {hoveredKey && snapshot.ownership[hoveredKey] && (
        <g>
          {(() => {
            const keyHash = hashKey(hoveredKey);
            const keyPt = ringPoint(keyHash, RING_RADIUS - 12);
            const owners = snapshot.ownership[hoveredKey] ?? [];
            return owners.map((ownerId) => {
              // Pick the owner's vnode whose position is closest clockwise from the key.
              const candidates = snapshot.tokens.filter((t) => t.nodeId === ownerId);
              if (candidates.length === 0) return null;
              const best = candidates.reduce((acc, t) => {
                const dist = (t.position - keyHash + 2 ** 32) % 2 ** 32;
                return dist < acc.dist ? { t, dist } : acc;
              }, { t: candidates[0], dist: (candidates[0].position - keyHash + 2 ** 32) % 2 ** 32 });
              const ownerPt = ringPoint(best.t.position, RING_RADIUS);
              return (
                <line
                  key={`arc-${hoveredKey}-${ownerId}`}
                  x1={keyPt.x}
                  y1={keyPt.y}
                  x2={ownerPt.x}
                  y2={ownerPt.y}
                  stroke="#ffffff"
                  strokeOpacity={0.5}
                  strokeWidth={1.2}
                />
              );
            });
          })()}
        </g>
      )}

      {Object.keys(snapshot.ownership).map((k) => {
        const owners = snapshot.ownership[k];
        if (!owners || owners.length === 0) return null;
        const color = colorForNode(owners[0]);
        const isHovered = hoveredKey === k;
        const isClaimedByHoveredToken = keysClaimedByHoveredToken.has(k);
        const lit = isHovered || isClaimedByHoveredToken;
        const p = ringPoint(hashKey(k), RING_RADIUS - 12);
        return (
          <g key={`k-${k}`}>
            {/* Invisible hit target sized to bridge the radial gap between
                the key dot (at radius RING_RADIUS - 12) and the ring track
                (at radius RING_RADIUS). Without this the user falls into a
                dead zone and lands on the vnode hover instead.
                pointer-events="all" is required because SVG's default
                visiblePainted skips transparent fills. */}
            <circle
              cx={p.x}
              cy={p.y}
              r={13}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredKey(k)}
              onMouseLeave={() => setHoveredKey(null)}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={lit ? 5 : 2.5}
              fill={color}
              opacity={lit ? 1 : 0.7}
              stroke={lit ? "#ffffff" : "none"}
              strokeWidth={lit ? 1 : 0}
              pointerEvents="none"
            />
            {lit && (
              <text
                x={p.x}
                y={p.y - 10}
                textAnchor="middle"
                fontSize={10}
                fill="#ffffff"
                style={{ pointerEvents: "none" }}
              >
                {k}
              </text>
            )}
          </g>
        );
      })}

      {/* Probe */}
      <AnimatePresence>
        {probePoint && probe && (
          <motion.circle
            key={`probe-${probe.spawnedAt}`}
            r={7}
            fill="#ffffff"
            fillOpacity={0.85}
            initial={{ cx: probePoint.x, cy: probePoint.y, opacity: 0 }}
            animate={{
              cx: ringPoint(
                snapshot.tokens.find((t) => t.nodeId === probe.trace.replicas[probe.trace.replicas.length - 1])
                  ?.position ?? probe.trace.position,
                RING_RADIUS
              ).x,
              cy: ringPoint(
                snapshot.tokens.find((t) => t.nodeId === probe.trace.replicas[probe.trace.replicas.length - 1])
                  ?.position ?? probe.trace.position,
                RING_RADIUS
              ).y,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: scaledSeconds(
                DURATION.probeWalkPerToken * Math.max(probe.trace.replicas.length, 1) * 4,
                speed
              ),
              delay: scaledSeconds(DURATION.calcFrame * 2, speed),
              times: [0, 0.05, 0.85, 1],
            }}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}
