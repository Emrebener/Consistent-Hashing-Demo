import { Ring } from "./core/ring";

/**
 * Populates a fresh Ring with the cluster the user sees on first load:
 * four physical nodes and a handful of demo keys, sized so the inspector
 * cards look non-trivial without being noisy.
 */
export function applySeed(ring: Ring): void {
  ring.addNode("N1");
  ring.addNode("N2");
  ring.addNode("N3");
  ring.addNode("N4");

  const demoKeys: Array<[string, string]> = [
    ["alice", "engineer"],
    ["bob", "designer"],
    ["carol", "pm"],
    ["dave", "manager"],
    ["eve", "ceo"],
    ["frank", "intern"],
    ["grace", "researcher"],
    ["heidi", "writer"],
  ];
  for (const [k, v] of demoKeys) ring.put(k, v);
}
