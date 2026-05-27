import { hashKey } from "./hash";
import type { CoreEvent, HashTrace } from "./events";
import type { NodeId, RingSnapshot, Token } from "./types";

export type RingConfig = {
  vnodesPerNode: number;
  replicationFactor: number;
};

export type OperationResult = { events: CoreEvent[] };

export class Ring {
  private nodeIds: NodeId[] = [];
  private tokens: Token[] = [];
  /** key -> list of replica nodeIds */
  private ownership: Map<string, NodeId[]> = new Map();
  /** nodeId -> key -> value */
  private data: Map<NodeId, Map<string, string>> = new Map();
  private replicationFactor: number;
  private vnodesPerNode: number;

  constructor(config: RingConfig) {
    this.replicationFactor = config.replicationFactor;
    this.vnodesPerNode = config.vnodesPerNode;
  }

  // ---------- public read ----------

  snapshot(): RingSnapshot {
    return {
      nodeIds: [...this.nodeIds],
      tokens: this.tokens.map((t) => ({ ...t })),
      ownership: Object.fromEntries(
        Array.from(this.ownership.entries()).map(([k, v]) => [k, [...v]])
      ),
      data: Object.fromEntries(
        Array.from(this.data.entries()).map(([n, m]) => [n, Object.fromEntries(m)])
      ),
      replicationFactor: this.replicationFactor,
      vnodesPerNode: this.vnodesPerNode,
    };
  }

  lookupReplicas(positionOrHash: number): NodeId[] {
    if (this.tokens.length === 0) return [];
    const effectiveRf = Math.min(this.replicationFactor, this.nodeIds.length);
    if (effectiveRf <= 0) return [];

    // Binary search: index of first token with position >= positionOrHash.
    let lo = 0;
    let hi = this.tokens.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.tokens[mid].position < positionOrHash) lo = mid + 1;
      else hi = mid;
    }
    const idx = lo === this.tokens.length ? 0 : lo;

    const out: NodeId[] = [];
    const seen = new Set<NodeId>();
    for (let step = 0; step < this.tokens.length && out.length < effectiveRf; step++) {
      const t = this.tokens[(idx + step) % this.tokens.length];
      if (!seen.has(t.nodeId)) {
        seen.add(t.nodeId);
        out.push(t.nodeId);
      }
    }
    return out;
  }

  // ---------- public write ----------

  /**
   * Recomputes replica sets for every stored key against the current tokens/RF,
   * physically migrates data, and emits one KeyMigrated event per key whose
   * replica set actually changed. Used by addNode, removeNode, and the slider
   * setters.
   */
  private rebalanceAll(): CoreEvent[] {
    const events: CoreEvent[] = [];
    for (const [key, oldOwners] of this.ownership) {
      const newOwners = this.lookupReplicas(hashKey(key));
      const sameSet =
        oldOwners.length === newOwners.length &&
        oldOwners.slice().sort().join(",") === newOwners.slice().sort().join(",");
      if (sameSet) continue;

      // Capture the value before mutating (it exists on every old owner).
      const value = this.data.get(oldOwners[0])?.get(key);

      // Remove from previous owners that are no longer replicas.
      for (const o of oldOwners) {
        if (!newOwners.includes(o)) this.data.get(o)?.delete(key);
      }
      // Add to new owners.
      for (const o of newOwners) {
        if (value !== undefined && !this.data.get(o)?.has(key)) {
          this.data.get(o)!.set(key, value);
        }
      }
      this.ownership.set(key, [...newOwners]);
      events.push({ type: "KeyMigrated", key, from: [...oldOwners], to: [...newOwners] });
    }
    return events;
  }

  addNode(nodeId: NodeId): OperationResult {
    if (this.nodeIds.includes(nodeId)) {
      throw new Error(`Node "${nodeId}" already exists`);
    }
    this.nodeIds.push(nodeId);
    this.data.set(nodeId, new Map());
    for (let i = 0; i < this.vnodesPerNode; i++) {
      const position = hashKey(`${nodeId}#${i}`);
      this.tokens.push({ position, vnodeIndex: i, nodeId });
    }
    this.tokens.sort((a, b) => a.position - b.position);

    const events: CoreEvent[] = [{ type: "NodeAdded", nodeId }];
    events.push(...this.rebalanceAll());
    return { events };
  }

  removeNode(nodeId: NodeId): OperationResult {
    if (!this.nodeIds.includes(nodeId)) {
      throw new Error(`Node "${nodeId}" does not exist`);
    }
    this.nodeIds = this.nodeIds.filter((n) => n !== nodeId);
    this.tokens = this.tokens.filter((t) => t.nodeId !== nodeId);
    this.data.delete(nodeId);

    const events: CoreEvent[] = [{ type: "NodeRemoved", nodeId }];

    // For keys whose old owners now reference the dropped node, fix up first.
    for (const [key, owners] of this.ownership) {
      if (owners.includes(nodeId)) {
        this.ownership.set(
          key,
          owners.filter((o) => o !== nodeId)
        );
      }
    }
    events.push(...this.rebalanceAll());
    return { events };
  }

  put(key: string, value: string): OperationResult {
    const trace = this.trace(key);
    if (trace.replicas.length === 0) {
      // Empty ring — no-op.
      return { events: [] };
    }
    const previous = this.ownership.get(key) ?? [];

    // Remove the key from any node that is no longer a replica.
    for (const oldOwner of previous) {
      if (!trace.replicas.includes(oldOwner)) {
        this.data.get(oldOwner)?.delete(key);
      }
    }
    // Write to every current replica.
    for (const owner of trace.replicas) {
      this.data.get(owner)!.set(key, value);
    }
    this.ownership.set(key, [...trace.replicas]);

    return { events: [{ type: "KeyWritten", trace, value }] };
  }

  get(key: string): OperationResult {
    const trace = this.trace(key);
    let value: string | undefined;
    if (trace.replicas.length > 0) {
      value = this.data.get(trace.replicas[0])?.get(key);
    }
    return { events: [{ type: "KeyRead", trace, value }] };
  }

  // ---------- internal helpers (unused for now; here so later tasks can grow them) ----------

  protected getEffectiveRf(): number {
    return Math.min(this.replicationFactor, this.nodeIds.length);
  }

  /** Computes hash + replica trace for a key without storing anything. */
  protected trace(key: string): HashTrace {
    const bytes = Array.from(new TextEncoder().encode(key));
    const digest = hashKey(key);
    const position = digest;
    const replicas = this.lookupReplicas(position);
    return { key, bytes, digest, position, replicas };
  }
}
