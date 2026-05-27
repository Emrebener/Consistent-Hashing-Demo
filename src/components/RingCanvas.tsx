import { useCallback, useEffect, useRef, useState } from "react";
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
const MIN_SCALE = 0.3;
const MAX_SCALE = 10;
const WHEEL_STEP = 1.1;

function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}
function ringPoint(position: number, radius: number): { x: number; y: number } {
  const a = positionToAngle(position);
  return { x: CENTER + Math.cos(a) * radius, y: CENTER + Math.sin(a) * radius };
}

type Probe = { trace: HashTrace; spawnedAt: number };
type View = { scale: number; panX: number; panY: number };
const DEFAULT_VIEW: View = { scale: 1, panX: 0, panY: 0 };

export function RingCanvas() {
  const snapshot = useRingStore((s) => s.snapshot);
  const lastEvents = useRingStore((s) => s.lastEvents);
  const speed = useRingStore((s) => s.speed);
  const hoveredNodeId = useHoverStore((s) => s.hoveredNodeId);
  const hoveredKey = useHoverStore((s) => s.hoveredKey);

  const [probe, setProbe] = useState<Probe | null>(null);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startView: View } | null>(null);

  /** Maps a clientX/Y in screen pixels to the SVG's viewBox coordinate space. */
  const clientToViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  // React 19's synthetic wheel listener is passive, so e.preventDefault() on
  // onWheel logs a console error. Attach a native non-passive listener via ref.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const vb = pt.matrixTransform(ctm.inverse());
      const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      setView((v) => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        if (newScale === v.scale) return v;
        const newPanX = vb.x - (vb.x - v.panX) * (newScale / v.scale);
        const newPanY = vb.y - (vb.y - v.panY) * (newScale / v.scale);
        return { scale: newScale, panX: newPanX, panY: newPanY };
      });
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // left-mouse-button only
    const vb = clientToViewBox(e.clientX, e.clientY);
    if (!vb) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: vb.x,
      startY: vb.y,
      startView: view,
    };
  }, [clientToViewBox, view]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      // Compute the cursor's viewBox position *under the starting transform* —
      // we want to find how far the cursor has moved in viewBox units and
      // shift the pan by that amount. clientToViewBox doesn't know about our
      // <g> transform, so it returns the raw SVG viewBox coords, which is what
      // we want here.
      const vb = clientToViewBox(e.clientX, e.clientY);
      if (!vb) return;
      const dx = vb.x - drag.startX;
      const dy = vb.y - drag.startY;
      setView({
        scale: drag.startView.scale,
        panX: drag.startView.panX + dx,
        panY: drag.startView.panY + dy,
      });
    },
    [clientToViewBox]
  );

  const endDrag = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }, []);

  const resetView = useCallback(() => setView(DEFAULT_VIEW), []);

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

  const isDefaultView = view.scale === 1 && view.panX === 0 && view.panY === 0;

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="absolute inset-0 m-auto h-full w-full touch-none select-none"
        role="img"
        aria-label="Consistent hashing ring"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      >
        <g id="ring-content" transform={`translate(${view.panX} ${view.panY}) scale(${view.scale})`}>
      <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} fill="none" stroke="#262626" strokeWidth={2} />

      {snapshot.tokens.map((t) => {
        const p = ringPoint(t.position, RING_RADIUS);
        const color = colorForNode(t.nodeId);
        const isReplica = probe?.trace.replicas.includes(t.nodeId) ?? false;
        const isHoveredNode = hoveredNodeId === t.nodeId;
        return (
          <motion.circle
            key={`${t.nodeId}#${t.vnodeIndex}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={color}
            stroke={isHoveredNode ? "#ffffff" : "#0a0a0a"}
            strokeWidth={isHoveredNode ? 1.5 : 1}
            initial={{ r: 0 }}
            animate={{ r: isReplica || isHoveredNode ? 7 : 4 }}
            transition={{ duration: 0.18 }}
          />
        );
      })}

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
        const p = ringPoint(hashKey(k), RING_RADIUS - 12);
        return (
          <g key={`k-${k}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={isHovered ? 5 : 2.5}
              fill={color}
              opacity={isHovered ? 1 : 0.7}
              stroke={isHovered ? "#ffffff" : "none"}
              strokeWidth={isHovered ? 1 : 0}
            />
            {isHovered && (
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
        </g>
      </svg>
      {!isDefaultView && (
        <button
          onClick={resetView}
          className="absolute right-4 top-4 z-10 rounded border border-neutral-700 bg-neutral-900/80 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          title="Reset zoom and pan"
        >
          Reset view
        </button>
      )}
    </>
  );
}
