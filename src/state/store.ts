import { create } from "zustand";
import { Ring } from "../core/ring";
import type { CoreEvent } from "../core/events";
import type { RingSnapshot } from "../core/types";

export type Speed = 0.25 | 0.5 | 1 | 2 | 4;

type State = {
  ring: Ring;
  snapshot: RingSnapshot;
  lastEvents: CoreEvent[];
  speed: Speed;
  stepMode: boolean;
};

type Actions = {
  addNode: () => void;
  removeNode: (nodeId: string) => void;
  put: (key: string, value: string) => void;
  get: (key: string) => void;
  setReplicationFactor: (rf: number) => void;
  setVnodesPerNode: (n: number) => void;
  setSpeed: (s: Speed) => void;
  toggleStepMode: () => void;
  reset: (seed: (r: Ring) => void) => void;
};

/**
 * Generates a fresh nodeId. Physical node ids are "N1", "N2", ... and increase
 * monotonically — they are never reused even after a node is removed, so the
 * palette assignment in palette.ts stays stable per node within a session.
 */
let nextNodeOrdinal = 1;
const allocateNodeId = (existing: string[]): string => {
  while (existing.includes(`N${nextNodeOrdinal}`)) nextNodeOrdinal++;
  return `N${nextNodeOrdinal++}`;
};

const INITIAL_VNODES = 16;
const INITIAL_RF = 3;

const makeInitialRing = (): Ring => {
  return new Ring({ vnodesPerNode: INITIAL_VNODES, replicationFactor: INITIAL_RF });
};

export const useRingStore = create<State & Actions>((set, get) => {
  const ring = makeInitialRing();

  const refresh = (events: CoreEvent[]) =>
    set({ snapshot: ring.snapshot(), lastEvents: events });

  return {
    ring,
    snapshot: ring.snapshot(),
    lastEvents: [],
    speed: 1,
    stepMode: false,

    addNode: () => {
      const { ring } = get();
      const id = allocateNodeId(ring.snapshot().nodeIds);
      const { events } = ring.addNode(id);
      refresh(events);
    },
    removeNode: (nodeId) => {
      const { ring } = get();
      const { events } = ring.removeNode(nodeId);
      refresh(events);
    },
    put: (key, value) => {
      const { ring } = get();
      const { events } = ring.put(key, value);
      refresh(events);
    },
    get: (key) => {
      const { ring } = get();
      const { events } = ring.get(key);
      refresh(events);
    },
    setReplicationFactor: (rf) => {
      const { ring } = get();
      const { events } = ring.setReplicationFactor(rf);
      refresh(events);
    },
    setVnodesPerNode: (n) => {
      const { ring } = get();
      const { events } = ring.setVnodesPerNode(n);
      refresh(events);
    },
    setSpeed: (s) => set({ speed: s }),
    toggleStepMode: () => set((s) => ({ stepMode: !s.stepMode })),

    reset: (seed) => {
      nextNodeOrdinal = 1;
      const fresh = makeInitialRing();
      seed(fresh);
      set({
        ring: fresh,
        snapshot: fresh.snapshot(),
        lastEvents: [],
        speed: 1,
        stepMode: false,
      });
    },
  };
});
