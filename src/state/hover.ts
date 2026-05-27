import { create } from "zustand";

type HoverState = {
  hoveredNodeId: string | null;
  hoveredKey: string | null;
  setHoveredNode: (id: string | null) => void;
  setHoveredKey: (k: string | null) => void;
};

export const useHoverStore = create<HoverState>((set) => ({
  hoveredNodeId: null,
  hoveredKey: null,
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setHoveredKey: (k) => set({ hoveredKey: k }),
}));
