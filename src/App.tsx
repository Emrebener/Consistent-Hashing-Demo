import { useRingStore } from "./state/store";
import { ControlsPanel } from "./components/ControlsPanel";
import { NodeInspector } from "./components/NodeInspector";
import { RingCanvas } from "./components/RingCanvas";
import { CalcPanel } from "./components/CalcPanel";

export default function App() {
  const snapshot = useRingStore((s) => s.snapshot);

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-6 py-3">
        <h1 className="text-lg font-semibold">Consistent Hashing Demo</h1>
        <div className="ml-auto flex gap-4 text-xs text-neutral-400">
          <span>Nodes: {snapshot.nodeIds.length}</span>
          <span>RF: {snapshot.replicationFactor}</span>
          <span>vnodes/node: {snapshot.vnodesPerNode}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_320px]">
        <aside id="controls-pane" className="border-r border-neutral-800 p-4 overflow-y-auto">
          <p className="mb-3 text-xs uppercase tracking-wider text-neutral-500">Controls</p>
          <ControlsPanel />
        </aside>

        <main id="ring-pane" className="relative min-h-0 overflow-hidden">
          <p className="absolute left-4 top-4 z-10 text-xs uppercase tracking-wider text-neutral-500">
            Ring
          </p>
          <RingCanvas />
        </main>

        <aside id="calc-pane" className="border-l border-neutral-800 p-4 overflow-y-auto">
          <p className="mb-3 text-xs uppercase tracking-wider text-neutral-500">Calculation</p>
          <CalcPanel />
        </aside>
      </div>

      <footer id="inspector-pane" className="border-t border-neutral-800 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Nodes</p>
        <NodeInspector />
      </footer>
    </div>
  );
}
