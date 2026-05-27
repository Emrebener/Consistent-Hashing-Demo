import { AnimatePresence } from "framer-motion";
import { useRingStore } from "../state/store";
import { NodeCard } from "./NodeCard";

export function NodeInspector() {
  const snapshot = useRingStore((s) => s.snapshot);
  const removeNode = useRingStore((s) => s.removeNode);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <AnimatePresence initial={false}>
        {snapshot.nodeIds.map((id) => (
          <NodeCard
            key={id}
            nodeId={id}
            snapshot={snapshot}
            onRemove={() => removeNode(id)}
            canRemove={snapshot.nodeIds.length > 1}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
