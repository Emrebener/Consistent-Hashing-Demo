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

describe("Ring — addNode migrates existing keys", () => {
  it("emits KeyMigrated only for keys whose replica set changed", () => {
    const r = new Ring({ vnodesPerNode: 16, replicationFactor: 2 });
    r.addNode("A");
    r.addNode("B");
    for (let i = 0; i < 20; i++) r.put(`k${i}`, `v${i}`);
    const before = r.snapshot();

    const { events } = r.addNode("C");
    const after = r.snapshot();

    const migrated = events.filter((e) => e.type === "KeyMigrated");
    // Determine which keys actually moved.
    let actuallyChanged = 0;
    for (const key of Object.keys(before.ownership)) {
      const beforeOwners = before.ownership[key].slice().sort().join(",");
      const afterOwners = (after.ownership[key] ?? []).slice().sort().join(",");
      if (beforeOwners !== afterOwners) actuallyChanged++;
    }
    expect(migrated.length).toBe(actuallyChanged);
  });

  it("preserves every key's value across migration", () => {
    const r = new Ring({ vnodesPerNode: 16, replicationFactor: 2 });
    r.addNode("A");
    r.addNode("B");
    for (let i = 0; i < 20; i++) r.put(`k${i}`, `v${i}`);
    r.addNode("C");
    const snap = r.snapshot();
    for (let i = 0; i < 20; i++) {
      const owners = snap.ownership[`k${i}`];
      expect(owners.length).toBe(2);
      for (const o of owners) {
        expect(snap.data[o][`k${i}`]).toBe(`v${i}`);
      }
    }
  });
});

describe("Ring — removeNode", () => {
  it("rejects removing an unknown node", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 1 });
    r.addNode("A");
    expect(() => r.removeNode("ghost")).toThrow(/does not exist/i);
  });

  it("removes all of the node's vnodes and its data entry", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");
    r.put("k", "v");
    r.removeNode("B");
    const snap = r.snapshot();
    expect(snap.nodeIds).not.toContain("B");
    expect(snap.data["B"]).toBeUndefined();
    expect(snap.tokens.every((t) => t.nodeId !== "B")).toBe(true);
  });

  it("reassigns every key the removed node held", () => {
    const r = new Ring({ vnodesPerNode: 32, replicationFactor: 2 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");
    for (let i = 0; i < 30; i++) r.put(`k${i}`, `v${i}`);
    r.removeNode("B");
    const snap = r.snapshot();
    for (let i = 0; i < 30; i++) {
      const owners = snap.ownership[`k${i}`];
      expect(owners).not.toContain("B");
      expect(owners.length).toBe(2);
      for (const o of owners) {
        expect(snap.data[o][`k${i}`]).toBe(`v${i}`);
      }
    }
  });
});

describe("Ring — setReplicationFactor", () => {
  it("rejects RF < 1", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 1 });
    expect(() => r.setReplicationFactor(0)).toThrow(/at least 1/i);
  });

  it("stores user-chosen RF even if > nodeCount and re-replicates when nodes catch up", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 1 });
    r.addNode("A");
    r.addNode("B");
    r.put("k", "v");
    r.setReplicationFactor(4); // stored as 4; effective = min(4, 2) = 2
    expect(r.snapshot().ownership["k"]).toHaveLength(2);
    r.addNode("C"); // effective becomes 3
    r.addNode("D"); // effective becomes 4
    expect(r.snapshot().ownership["k"]).toHaveLength(4);
  });

  it("emits KeyMigrated events for keys whose replica set widened", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 1 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");
    for (let i = 0; i < 5; i++) r.put(`k${i}`, `v${i}`);
    const { events } = r.setReplicationFactor(3);
    expect(events.filter((e) => e.type === "KeyMigrated")).toHaveLength(5);
  });
});

describe("Ring — setVnodesPerNode", () => {
  it("rejects values < 1 or > 64", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 1 });
    r.addNode("A");
    expect(() => r.setVnodesPerNode(0)).toThrow();
    expect(() => r.setVnodesPerNode(65)).toThrow();
  });

  it("regenerates tokens for all nodes", () => {
    const r = new Ring({ vnodesPerNode: 4, replicationFactor: 1 });
    r.addNode("A");
    r.addNode("B");
    r.setVnodesPerNode(16);
    const snap = r.snapshot();
    expect(snap.tokens).toHaveLength(32);
    expect(snap.vnodesPerNode).toBe(16);
    // Still sorted.
    const positions = snap.tokens.map((t) => t.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("preserves every key's value across vnode rebalance", () => {
    const r = new Ring({ vnodesPerNode: 8, replicationFactor: 2 });
    r.addNode("A");
    r.addNode("B");
    r.addNode("C");
    for (let i = 0; i < 10; i++) r.put(`k${i}`, `v${i}`);
    r.setVnodesPerNode(32);
    const snap = r.snapshot();
    for (let i = 0; i < 10; i++) {
      for (const o of snap.ownership[`k${i}`]) {
        expect(snap.data[o][`k${i}`]).toBe(`v${i}`);
      }
    }
  });
});
