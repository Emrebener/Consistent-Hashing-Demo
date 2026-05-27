import { describe, it, expect } from "vitest";
import { Ring } from "./ring";
import { hashKey } from "./hash";

describe("Ring — addNode", () => {
  it("starts empty", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 1 });
    const snap = r.snapshot();
    expect(snap.nodeIds).toEqual([]);
    expect(snap.tokens).toEqual([]);
  });

  it("adds vnodesPerNode tokens per physical node", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 1 });
    const { events } = r.addNode("A");
    expect(r.snapshot().nodeIds).toEqual(["A"]);
    expect(r.snapshot().tokens).toHaveLength(4);
    expect(events.find((e) => e.type === "NodeAdded")).toBeTruthy();
  });

  it("keeps tokens sorted by position after multiple adds", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 1 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");
    const positions = r.snapshot().tokens.map((t) => t.position);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it("rejects adding the same nodeId twice", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 1 });
    r.addNode("A");
    expect(() => r.addNode("A")).toThrow(/already exists/i);
  });
});

describe("Ring — lookupReplicas", () => {
  it("returns [] on an empty ring", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 3 });
    expect(r.lookupReplicas(hashKey("anything"))).toEqual([]);
  });

  it("returns a single node when there is only one", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 3 });
    r.addNode("A");
    // Effective RF = min(3, 1) = 1
    expect(r.lookupReplicas(hashKey("k1"))).toEqual(["A"]);
  });

  it("skips duplicate physical nodes when walking", () => {
    // With many vnodes per node, the next several tokens after any hash are
    // very likely to include duplicates. Replica selection must skip them.
    const r = new Ring({ vnodesPerNode: 32, replicationFactor: 3 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");

    for (let i = 0; i < 50; i++) {
      const replicas = r.lookupReplicas(hashKey(`k${i}`));
      expect(replicas).toHaveLength(3);
      expect(new Set(replicas).size).toBe(3); // all distinct physical nodes
    }
  });

  it("clamps effective RF to nodeCount when RF > nodeCount", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 5 });
    r.addNode("A");
    r.addNode("B");
    const replicas = r.lookupReplicas(hashKey("any"));
    expect(replicas).toHaveLength(2);
    expect(new Set(replicas).size).toBe(2);
  });

  it("is deterministic for the same input", () => {
    const r1 = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    const r2 = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    for (const id of ["X", "Y", "Z"]) {
      r1.addNode(id);
      r2.addNode(id);
    }
    expect(r1.lookupReplicas(hashKey("key"))).toEqual(r2.lookupReplicas(hashKey("key")));
  });

  it("wraps around the ring end", () => {
    // Use a key whose hash is near 0xFFFFFFFF — the walk must wrap to index 0.
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    r.addNode("A");
    r.addNode("B");
    // Try several keys; at least one will land near the top of the ring.
    let foundWrap = false;
    for (let i = 0; i < 200; i++) {
      const h = hashKey(`probe${i}`);
      const replicas = r.lookupReplicas(h);
      expect(replicas.length).toBeGreaterThan(0);
      // If the hash is past the highest token, the walk wrapped.
      const maxPos = Math.max(...r.snapshot().tokens.map((t) => t.position));
      if (h > maxPos) foundWrap = true;
    }
    expect(foundWrap).toBe(true);
  });
});
