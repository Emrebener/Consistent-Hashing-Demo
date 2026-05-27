export type NodeId = string;

export type Token = {
  /** Position on the ring, 0 ≤ position < 2^32. */
  position: number;
  /** Index of the vnode within its physical node, used to build the token's hash input. */
  vnodeIndex: number;
  /** The physical node this token belongs to. */
  nodeId: NodeId;
};

export type KeyValue = { key: string; value: string };

export type RingSnapshot = {
  /** Physical node IDs in insertion order. */
  nodeIds: NodeId[];
  /** All vnode tokens, sorted ascending by `position`. */
  tokens: Token[];
  /** key → list of replica nodeIds that currently store it. */
  ownership: Record<string, NodeId[]>;
  /** nodeId → key → value. */
  data: Record<NodeId, Record<string, string>>;
  /** Stored (user-chosen) replication factor. Effective RF is min(replicationFactor, nodeIds.length). */
  replicationFactor: number;
  vnodesPerNode: number;
};
