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

describe("Ring — put / get", () => {
  it("stores a key on all effective-RF replicas", () => {
    const r = new Ring({ vnodesPerNode: 16, replicationFactor: 3 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");
    r.addNode("D");

    const { events } = r.put("alice", "value-1");
    const snap = r.snapshot();

    expect(snap.ownership["alice"]).toHaveLength(3);
    for (const replica of snap.ownership["alice"]) {
      expect(snap.data[replica]["alice"]).toBe("value-1");
    }
    const written = events.find((e) => e.type === "KeyWritten");
    expect(written).toBeTruthy();
    if (written && written.type === "KeyWritten") {
      expect(written.value).toBe("value-1");
      expect(written.trace.key).toBe("alice");
      expect(written.trace.replicas).toEqual(snap.ownership["alice"]);
    }
  });

  it("get returns the stored value", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    r.addNode("A");
    r.addNode("B");
    r.put("k", "v");
    const { events } = r.get("k");
    const read = events.find((e) => e.type === "KeyRead");
    expect(read).toBeTruthy();
    if (read && read.type === "KeyRead") {
      expect(read.value).toBe("v");
      expect(read.trace.key).toBe("k");
    }
  });

  it("get returns undefined for an unknown key", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    r.addNode("A");
    const { events } = r.get("nope");
    const read = events.find((e) => e.type === "KeyRead");
    expect(read).toBeTruthy();
    if (read && read.type === "KeyRead") {
      expect(read.value).toBeUndefined();
    }
  });

  it("put on an empty ring is a no-op and emits no KeyWritten", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    const { events } = r.put("orphan", "v");
    expect(events.find((e) => e.type === "KeyWritten")).toBeFalsy();
    expect(r.snapshot().ownership["orphan"]).toBeUndefined();
  });

  it("overwriting a key updates value on all current replicas", () => {
    const r = new Ring({ vnodesPerNode: 16, replicationFactor: 3 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");
    r.put("k", "v1");
    r.put("k", "v2");
    const snap = r.snapshot();
    for (const replica of snap.ownership["k"]) {
      expect(snap.data[replica]["k"]).toBe("v2");
    }
  });
});
