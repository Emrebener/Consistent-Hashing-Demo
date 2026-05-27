import { useState } from "react";
import { useRingStore, type Speed } from "../state/store";

const SPEEDS: Speed[] = [0.25, 0.5, 1, 2, 4];

export function ControlsPanel() {
  const snapshot = useRingStore((s) => s.snapshot);
  const addNode = useRingStore((s) => s.addNode);
  const put = useRingStore((s) => s.put);
  const get = useRingStore((s) => s.get);
  const setRF = useRingStore((s) => s.setReplicationFactor);
  const setVnodes = useRingStore((s) => s.setVnodesPerNode);
  const speed = useRingStore((s) => s.speed);
  const setSpeed = useRingStore((s) => s.setSpeed);
  const stepMode = useRingStore((s) => s.stepMode);
  const toggleStepMode = useRingStore((s) => s.toggleStepMode);

  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const nodeCount = snapshot.nodeIds.length;
  const atNodeCap = nodeCount >= 12;
  const rfClamped = snapshot.replicationFactor > nodeCount;

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Cluster</p>
        <div className="flex gap-2">
          <button
            onClick={addNode}
            disabled={atNodeCap}
            className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 hover:bg-neutral-700 disabled:opacity-40"
            title={atNodeCap ? "Cluster cap: 12 nodes" : "Add node"}
          >
            + Add node
          </button>
        </div>

        <label className="mt-3 block">
          <div className="mb-1 flex justify-between text-xs text-neutral-400">
            <span>Replication factor</span>
            <span>
              {snapshot.replicationFactor}
              {rfClamped && (
                <span className="ml-1 text-amber-400">→ effective {nodeCount}</span>
              )}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={snapshot.replicationFactor}
            onChange={(e) => setRF(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </label>

        <label className="mt-3 block">
          <div className="mb-1 flex justify-between text-xs text-neutral-400">
            <span>vnodes per node</span>
            <span>{snapshot.vnodesPerNode}</span>
          </div>
          <input
            type="range"
            min={1}
            max={64}
            step={1}
            value={snapshot.vnodesPerNode}
            onChange={(e) => setVnodes(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </label>
      </section>

      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Operation</p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key"
          className="mb-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className="mb-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        />
        <div className="flex gap-2">
          <button
            onClick={() => put(key, value)}
            disabled={key.length === 0 || nodeCount === 0}
            className="flex-1 rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 hover:bg-emerald-900/60 disabled:opacity-40"
          >
            PUT
          </button>
          <button
            onClick={() => get(key)}
            disabled={key.length === 0 || nodeCount === 0}
            className="flex-1 rounded border border-blue-700 bg-blue-900/30 px-2 py-1 hover:bg-blue-900/60 disabled:opacity-40"
          >
            GET
          </button>
        </div>
        {nodeCount === 0 && (
          <p className="mt-2 text-xs text-amber-400">Add a node first.</p>
        )}
      </section>

      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Pacing</p>
        <div className="flex flex-wrap gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={
                "rounded border px-2 py-0.5 text-xs " +
                (speed === s
                  ? "border-neutral-300 bg-neutral-200 text-neutral-900"
                  : "border-neutral-700 hover:bg-neutral-800")
              }
            >
              {s}×
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={stepMode}
            onChange={toggleStepMode}
          />
          Step through calc panel manually
        </label>
      </section>
    </div>
  );
}
