import { useState } from "react";
import { motion } from "framer-motion";
import { colorForNode } from "../lib/palette";
import type { RingSnapshot } from "../core/types";

type Props = {
  nodeId: string;
  snapshot: RingSnapshot;
  onRemove: () => void;
  canRemove: boolean;
};

export function NodeCard({ nodeId, snapshot, onRemove, canRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = colorForNode(nodeId);
  const stored = snapshot.data[nodeId] ?? {};
  const keys = Object.keys(stored).sort();

  return (
    <motion.div
      data-node-card-id={nodeId}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs min-w-[140px]"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold">{nodeId}</span>
        <span className="ml-auto text-neutral-400">{keys.length} keys</span>
      </div>
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-neutral-400 hover:text-neutral-100"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
        <button
          onClick={onRemove}
          disabled={!canRemove}
          className="ml-auto text-neutral-500 hover:text-red-400 disabled:opacity-30"
          title={canRemove ? "Remove node" : "Cluster must have at least one node"}
        >
          remove
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-[11px] text-neutral-300">
          {keys.length === 0 && <li className="text-neutral-600">no keys</li>}
          {keys.map((k) => (
            <li key={k} className="flex justify-between gap-2">
              <span className="truncate">{k}</span>
              <span className="text-neutral-500">{stored[k]}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
