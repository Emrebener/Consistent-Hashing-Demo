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
  durationMs: number;
};

const RING_RADIUS = 180;
const VIEW = 480;
const CENTER = VIEW / 2;

function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}

/**
 * Converts a ring position to screen coordinates by asking the SVG itself
 * via getScreenCTM(). The matrix already accounts for the viewBox mapping,
 * the SVG's rendered size, and any pan/zoom transform applied to the
 * #ring-content group — so this stays correct under zoom and pan.
 */
function ringPositionToScreen(position: number): { x: number; y: number } | null {
  const g = document.querySelector("#ring-content") as SVGGElement | null;
  if (!g) return null;
  const svg = g.ownerSVGElement;
  if (!svg) return null;
  const ctm = g.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  const a = positionToAngle(position);
  pt.x = CENTER + Math.cos(a) * RING_RADIUS;
  pt.y = CENTER + Math.sin(a) * RING_RADIUS;
  const out = pt.matrixTransform(ctm);
  return { x: out.x, y: out.y };
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
    const start = seenRef.current;
    seenRef.current = lastEvents.length;

    const writeDelay = scaledSeconds(DURATION.calcFrame * 3, speed) * 1000;
    const migrateDelay = 0; // migrations fire immediately

    const writeDrops: Drop[] = [];
    const migrateDrops: Drop[] = [];

    for (let i = start; i < lastEvents.length; i++) {
      const e = lastEvents[i];
      if (e.type === "KeyWritten") {
        const from = ringPositionToScreen(e.trace.position);
        if (!from) continue;
        for (const replica of e.trace.replicas) {
          const to = cardCenter(replica);
          if (!to) continue;
          writeDrops.push({
            id: `w-${e.trace.key}-${replica}-${Date.now()}-${Math.random()}`,
            from,
            to,
            color: colorForNode(replica),
            durationMs: DURATION.keyDrop,
          });
        }
      } else if (e.type === "KeyMigrated") {
        // For each *new* owner that wasn't in the old set, fly a dot from any
        // remaining old owner (or the first old owner if none persist).
        const newOwners = e.to.filter((n) => !e.from.includes(n));
        const sourceOwner = e.from.find((n) => e.to.includes(n)) ?? e.from[0];
        const fromPt = sourceOwner ? cardCenter(sourceOwner) : null;
        for (const dest of newOwners) {
          const toPt = cardCenter(dest);
          if (!fromPt || !toPt) continue;
          migrateDrops.push({
            id: `m-${e.key}-${dest}-${Date.now()}-${Math.random()}`,
            from: fromPt,
            to: toPt,
            color: colorForNode(dest),
            durationMs: DURATION.keyMigrate,
          });
        }
      }
    }

    if (writeDrops.length === 0 && migrateDrops.length === 0) return;

    const timers: number[] = [];
    if (migrateDrops.length > 0) {
      const id = window.setTimeout(
        () => setDrops((d) => [...d, ...migrateDrops]),
        migrateDelay
      );
      timers.push(id);
    }
    if (writeDrops.length > 0) {
      const id = window.setTimeout(
        () => setDrops((d) => [...d, ...writeDrops]),
        writeDelay
      );
      timers.push(id);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [lastEvents, speed]);

  // Garbage-collect drops shortly after their animation finishes.
  useEffect(() => {
    if (drops.length === 0) return;
    const maxMs = Math.max(...drops.map((d) => d.durationMs));
    const id = setTimeout(
      () => setDrops([]),
      scaledSeconds(maxMs, speed) * 1000 + 200
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
            transition={{ duration: scaledSeconds(d.durationMs, speed), ease: [0.34, 1.56, 0.64, 1] }}
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
