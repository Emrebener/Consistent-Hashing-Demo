import { create } from "zustand";

export type HoveredToken = { nodeId: string; vnodeIndex: number };

type HoverState = {
  hoveredNodeId: string | null;
  hoveredKey: string | null;
  hoveredToken: HoveredToken | null;
  setHoveredNode: (id: string | null) => void;
  setHoveredKey: (k: string | null) => void;
  setHoveredToken: (t: HoveredToken | null) => void;
};

export const useHoverStore = create<HoverState>((set) => ({
  hoveredNodeId: null,
  hoveredKey: null,
  hoveredToken: null,
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setHoveredKey: (k) => set({ hoveredKey: k }),
  setHoveredToken: (t) => set({ hoveredToken: t }),
}));
