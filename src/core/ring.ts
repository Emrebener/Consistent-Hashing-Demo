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
    // Key-migration logic is added in Task 6 (once put/get exist in Task 5).
    // For the first addNode there are no stored keys to migrate yet, so just
    // emit NodeAdded.
    return { events };
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
