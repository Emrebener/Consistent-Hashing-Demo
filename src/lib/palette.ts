// src/lib/palette.ts

/**
 * Twelve qualitative colors, chosen for distinguishability on a dark
 * background and roughly evenly spaced in hue. The cap matches the
 * 12-node ceiling enforced by the UI.
 */
const PALETTE = [
  "#60a5fa", // blue-400
  "#f472b6", // pink-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#a78bfa", // violet-400
  "#fb7185", // rose-400
  "#22d3ee", // cyan-400
  "#facc15", // yellow-400
  "#4ade80", // green-400
  "#f87171", // red-400
  "#c084fc", // purple-400
  "#fdba74", // orange-300
] as const;

/**
 * Maps a nodeId of the form "N<ordinal>" to a stable palette color.
 * The ordinal mod PALETTE.length picks the hue, so a single session that
 * never exceeds 12 concurrent nodes gets unique colors per node.
 */
export function colorForNode(nodeId: string): string {
  const m = /^N(\d+)$/.exec(nodeId);
  const ordinal = m ? parseInt(m[1], 10) : 0;
  return PALETTE[(ordinal - 1 + PALETTE.length) % PALETTE.length];
}

export const PALETTE_COLORS = PALETTE;
