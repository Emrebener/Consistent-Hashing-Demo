import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRingStore } from "../state/store";
import { colorForNode } from "../lib/palette";
import { DURATION, scaledSeconds } from "../lib/animation";

type Drop = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
};

const RING_RADIUS = 180;
const VIEW = 480;
const CENTER = VIEW / 2;

function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}

/** Converts a ring position to screen coordinates by reading the live SVG element. */
function ringPositionToScreen(position: number): { x: number; y: number } | null {
  const svg = document.querySelector("svg[aria-label='Consistent hashing ring']") as SVGSVGElement | null;
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  // The SVG uses viewBox 0 0 480 480 with preserveAspectRatio default (xMidYMid meet).
  // Within the rendered SVG box, the viewBox is centered. Compute scale and offsets.
  const scale = Math.min(rect.width / VIEW, rect.height / VIEW);
  const drawnW = VIEW * scale;
  const drawnH = VIEW * scale;
  const offsetX = rect.left + (rect.width - drawnW) / 2;
  const offsetY = rect.top + (rect.height - drawnH) / 2;
  const a = positionToAngle(position);
  const vbX = CENTER + Math.cos(a) * RING_RADIUS;
  const vbY = CENTER + Math.sin(a) * RING_RADIUS;
  return { x: offsetX + vbX * scale, y: offsetY + vbY * scale };
}

function cardCenter(nodeId: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-node-card-id="${nodeId}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function DropOverlay() {
  const lastEvents = useRingStore((s) => s.lastEvents);
  const speed = useRingStore((s) => s.speed);
  const seenRef = useRef<number>(0);
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    // Process every event added since last render.
    const start = seenRef.current;
    seenRef.current = lastEvents.length;
    const ringDelay = scaledSeconds(DURATION.calcFrame * 3, speed) * 1000;

    const newDrops: Drop[] = [];
    for (let i = start; i < lastEvents.length; i++) {
      const e = lastEvents[i];
      if (e.type !== "KeyWritten") continue;
      const from = ringPositionToScreen(e.trace.position);
      if (!from) continue;
      for (const replica of e.trace.replicas) {
        const to = cardCenter(replica);
        if (!to) continue;
        newDrops.push({
          id: `${e.trace.key}-${replica}-${Date.now()}-${Math.random()}`,
          from,
          to,
          color: colorForNode(replica),
        });
      }
    }
    if (newDrops.length === 0) return;
    // Delay spawning until the probe walk completes, then auto-clear after the drop duration.
    const totalDelay = ringDelay;
    const id = setTimeout(() => setDrops((d) => [...d, ...newDrops]), totalDelay);
    return () => clearTimeout(id);
  }, [lastEvents, speed]);

  // Garbage-collect drops shortly after their animation finishes.
  useEffect(() => {
    if (drops.length === 0) return;
    const id = setTimeout(
      () => setDrops([]),
      scaledSeconds(DURATION.keyDrop, speed) * 1000 + 200
    );
    return () => clearTimeout(id);
  }, [drops, speed]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {drops.map((d) => (
          <motion.div
            key={d.id}
            initial={{ x: d.from.x, y: d.from.y, opacity: 0.9, scale: 1 }}
            animate={{ x: d.to.x, y: d.to.y, opacity: 0, scale: 0.6 }}
            transition={{ duration: scaledSeconds(DURATION.keyDrop, speed), ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: "absolute",
              left: -5,
              top: -5,
              width: 10,
              height: 10,
              borderRadius: "9999px",
              background: d.color,
              boxShadow: `0 0 8px ${d.color}`,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
