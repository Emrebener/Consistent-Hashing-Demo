import type { NodeId } from "./types";

export type HashTrace = {
  key: string;
  /** UTF-8 byte sequence of the key. */
  bytes: number[];
  /** 32-bit FNV-1a digest. */
  digest: number;
  /** Ring position (== digest for ring size 2^32). */
  position: number;
  /** Replica nodeIds in walk order. */
  replicas: NodeId[];
};

export type CoreEvent =
  | { type: "NodeAdded"; nodeId: NodeId }
  | { type: "NodeRemoved"; nodeId: NodeId }
  | { type: "KeyMigrated"; key: string; from: NodeId[]; to: NodeId[] }
  | { type: "KeyWritten"; trace: HashTrace; value: string }
  | { type: "KeyRead"; trace: HashTrace; value: string | undefined };
