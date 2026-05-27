import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRingStore } from "../state/store";
import { DURATION, scaledSeconds } from "../lib/animation";
import type { HashTrace } from "../core/events";

type ActiveOp = { kind: "PUT" | "GET"; trace: HashTrace; value: string | undefined };

export function CalcPanel() {
  const lastEvents = useRingStore((s) => s.lastEvents);
  const speed = useRingStore((s) => s.speed);
  const stepMode = useRingStore((s) => s.stepMode);

  const [op, setOp] = useState<ActiveOp | null>(null);
  const [frame, setFrame] = useState(0);

  // When a new KeyWritten or KeyRead event arrives, start playing from frame 0.
  useEffect(() => {
    for (let i = lastEvents.length - 1; i >= 0; i--) {
      const e = lastEvents[i];
      if (e.type === "KeyWritten") {
        setOp({ kind: "PUT", trace: e.trace, value: e.value });
        setFrame(0);
        return;
      }
      if (e.type === "KeyRead") {
        setOp({ kind: "GET", trace: e.trace, value: e.value });
        setFrame(0);
        return;
      }
    }
  }, [lastEvents]);

  // Auto-advance frames unless step mode is on.
  useEffect(() => {
    if (!op) return;
    if (frame >= 3) return;
    if (stepMode) return;
    const id = setTimeout(
      () => setFrame((f) => f + 1),
      scaledSeconds(DURATION.calcFrame, speed) * 1000
    );
    return () => clearTimeout(id);
  }, [op, frame, stepMode, speed]);

  if (!op) {
    return (
      <p className="text-xs text-neutral-500">
        Trigger a PUT or GET to see the calculation.
      </p>
    );
  }

  const { trace, kind, value } = op;
  const hex = trace.digest.toString(16).padStart(8, "0").toUpperCase();
  const angleDeg = ((trace.position / 2 ** 32) * 360).toFixed(2);

  return (
    <div className="space-y-3 text-xs">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">
        {kind} <span className="text-neutral-300">{trace.key}</span>
      </p>

      <Frame visible={frame >= 0} label="1. Key bytes (UTF-8)">
        <code className="block break-all rounded bg-neutral-900 p-2">
          {trace.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")}
        </code>
      </Frame>

      <Frame visible={frame >= 1} label="2. FNV-1a digest">
        <code className="block rounded bg-neutral-900 p-2">0x{hex}</code>
      </Frame>

      <Frame visible={frame >= 2} label="3. Ring position">
        <code className="block rounded bg-neutral-900 p-2">{angleDeg}° on the ring</code>
      </Frame>

      <Frame visible={frame >= 3} label="4. Replica walk">
        <ol className="list-decimal space-y-1 rounded bg-neutral-900 p-2 pl-6">
          {trace.replicas.map((id) => (
            <li key={id}>
              <code>{id}</code>
            </li>
          ))}
        </ol>
        {kind === "GET" && (
          <p className="mt-2 text-neutral-300">
            Result: <code>{value === undefined ? "<not found>" : value}</code>
          </p>
        )}
      </Frame>

      {stepMode && frame < 3 && (
        <button
          onClick={() => setFrame((f) => f + 1)}
          className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
        >
          Next step →
        </button>
      )}
    </div>
  );
}

function Frame({
  visible,
  label,
  children,
}: {
  visible: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <p className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">
            {label}
          </p>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
