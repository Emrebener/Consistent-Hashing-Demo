import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRingStore } from "../state/store";
import { colorForNode } from "../lib/palette";
import { DURATION, scaledSeconds } from "../lib/animation";
import type { HashTrace } from "../core/events";

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
        return (
          <motion.circle
            key={`${t.nodeId}#${t.vnodeIndex}`}
            cx={p.x}
            cy={p.y}
            r={isReplica ? 6 : 4}
            fill={color}
            stroke="#0a0a0a"
            strokeWidth={1}
            initial={{ r: 0 }}
            animate={{ r: isReplica ? 6 : 4 }}
            transition={{ duration: scaledSeconds(DURATION.vnodeFanInPerToken, speed) }}
          />
        );
      })}

      {Object.keys(snapshot.ownership).map((k) => {
        const owners = snapshot.ownership[k];
        if (!owners || owners.length === 0) return null;
        const color = colorForNode(owners[0]);
        const firstOwner = owners[0];
        const firstToken = snapshot.tokens.find((t) => t.nodeId === firstOwner);
        if (!firstToken) return null;
        const p = ringPoint(firstToken.position, RING_RADIUS - 12);
        return <circle key={`k-${k}`} cx={p.x} cy={p.y} r={2.5} fill={color} opacity={0.7} />;
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
