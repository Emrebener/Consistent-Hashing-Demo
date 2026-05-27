# Consistent Hashing Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive, browser-only demonstration of Cassandra/DynamoDB-style consistent hashing with virtual nodes, configurable replication factor, and step-by-step animated visualization of read/write operations and cluster reshape.

**Architecture:** Pure-frontend SPA in three strict layers. `src/core/` holds the deterministic, pure ring/hash/event logic and is tested with Vitest. `src/state/` is a single thin Zustand store wrapping a `Ring` instance. `src/components/` is the React + Framer Motion view tree (three-pane IDE-style layout: controls left, ring center, calc-panel right, node inspector bottom). The boundary rule: `core/` never imports from `state/` or `components/`; components never mutate ring state directly.

**Tech Stack:** Vite, React 18, TypeScript, Framer Motion, Tailwind CSS, Zustand, Vitest, React Testing Library, FNV-1a (hand-rolled).

**Spec:** `docs/superpowers/specs/2026-05-27-consistent-hashing-demo-design.md`

---

## Phase 1 — Project scaffold

### Task 1: Initialize Vite + React + TypeScript + Tailwind project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/vite-env.d.ts`, `.gitignore`

- [ ] **Step 1: Scaffold the project from the Vite template**

Run:
```bash
cd /home/emre/Projeler/Consistent-Hashing-Demo
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty… how would you like to proceed?" pick **"Ignore files and continue."** This preserves the existing `.git`, `README.md`, `docs/`, `.gitignore`, and `.superpowers/`.

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install zustand framer-motion
npm install -D tailwindcss@^3 postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
```

(Tailwind v3 is pinned because v4 changes its config story; the spec assumes v3-style `tailwind.config.ts`.)

- [ ] **Step 3: Initialize Tailwind**

```bash
npx tailwindcss init -p
```

Then rename `tailwind.config.js` → `tailwind.config.ts` and replace its contents:

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Replace `src/index.css` with Tailwind directives**

Overwrite `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body {
  @apply bg-neutral-950 text-neutral-100 antialiased;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

(Delete `src/App.css` if the Vite template created it — we'll style with Tailwind only.)

- [ ] **Step 5: Replace `src/App.tsx` with a minimal placeholder**

```tsx
export default function App() {
  return (
    <div className="grid h-full place-items-center text-neutral-400">
      <p>Consistent Hashing Demo — scaffolding ok.</p>
    </div>
  );
}
```

Update `src/main.tsx` to import `./index.css` (the Vite template already does this; verify and adjust if needed).

- [ ] **Step 6: Configure Vitest**

Edit `vite.config.ts` to add a `test` section. Replace the file with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
```

The `defineConfig` import from `vite` will not include the `test` field type. Add a triple-slash reference at the top:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// ...rest as above
```

Create `src/setupTests.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Add npm scripts**

Edit `package.json`'s `scripts` block to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 8: Ensure `.gitignore` covers Node/Vite output**

Append to existing `.gitignore` (which already contains `.superpowers/`):

```
node_modules/
dist/
.vite/
*.log
```

- [ ] **Step 9: Run dev server smoke check**

```bash
npm run dev
```

Expected: prints a localhost URL, no errors. Curl it to confirm:

```bash
curl -s http://localhost:5173/ | grep -q '<div id="root"' && echo OK
```

Expected: `OK`. Stop the dev server (Ctrl-C).

- [ ] **Step 10: Run the test runner smoke check**

```bash
npm run test
```

Expected: "No test files found" (exit code 0 or 1 depending on Vitest version) — confirms Vitest is wired but we haven't written tests yet.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"
```

---

## Phase 2 — Core (pure, no UI)

### Task 2: Implement FNV-1a 32-bit hash with tests

**Files:**
- Create: `src/core/hash.ts`
- Create: `src/core/hash.test.ts`

- [ ] **Step 1: Write failing tests for `hashKey`**

Create `src/core/hash.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashKey } from "./hash";

describe("hashKey (FNV-1a 32-bit)", () => {
  it("returns 0x811c9dc5 for the empty string", () => {
    // FNV-1a offset basis: the empty string's hash is the offset basis itself.
    expect(hashKey("")).toBe(0x811c9dc5);
  });

  it("returns the published vector for 'a'", () => {
    // Standard FNV-1a 32-bit vector for 'a': 0xe40c292c
    expect(hashKey("a")).toBe(0xe40c292c);
  });

  it("returns the published vector for 'foobar'", () => {
    // Standard FNV-1a 32-bit vector for 'foobar': 0xbf9cf968
    expect(hashKey("foobar")).toBe(0xbf9cf968);
  });

  it("is deterministic", () => {
    const a = hashKey("alice");
    const b = hashKey("alice");
    expect(a).toBe(b);
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const s of ["", "a", "abc", "Node-1#0", "🚀", "the quick brown fox"]) {
      const h = hashKey(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- hash
```

Expected: FAIL with module-not-found / `hashKey is not a function`.

- [ ] **Step 3: Implement `hashKey`**

Create `src/core/hash.ts`:

```ts
const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

/**
 * FNV-1a 32-bit hash. Non-cryptographic, deterministic, fast.
 * UTF-8 encodes the input first so multi-byte characters hash consistently.
 */
export function hashKey(input: string): number {
  const bytes = new TextEncoder().encode(input);
  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    // Math.imul + >>> 0 keeps the multiply in unsigned 32-bit space.
    hash = Math.imul(hash, FNV_PRIME_32) >>> 0;
  }
  return hash >>> 0;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- hash
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/core/hash.ts src/core/hash.test.ts
git commit -m "feat(core): add FNV-1a 32-bit hashKey"
```

---

### Task 3: Define core types and event union

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/events.ts`

- [ ] **Step 1: Create `src/core/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/core/events.ts`**

```ts
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

Expected: clean exit, no errors. (No tests yet for these files — they're pure type definitions plus a string-literal union.)

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts src/core/events.ts
git commit -m "feat(core): add ring types and event union"
```

---

### Task 4: Implement `Ring` class — addNode, lookupReplicas, sort invariant

**Files:**
- Create: `src/core/ring.ts`
- Create: `src/core/ring.test.ts`

- [ ] **Step 1: Write failing tests for `addNode` and `lookupReplicas`**

Create `src/core/ring.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test -- ring
```

Expected: FAIL with "Ring is not defined" / module-not-found.

- [ ] **Step 3: Implement the initial `Ring` class**

Create `src/core/ring.ts`:

```ts
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
    let idx = lo === this.tokens.length ? 0 : lo;

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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test -- ring
```

Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/core/ring.ts src/core/ring.test.ts
git commit -m "feat(core): add Ring with addNode and lookupReplicas"
```

---

### Task 5: Extend `Ring` with `put` and `get`

**Files:**
- Modify: `src/core/ring.ts`
- Modify: `src/core/ring.test.ts`

- [ ] **Step 1: Append failing tests for `put` and `get`**

Append to `src/core/ring.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
npm run test -- ring
```

Expected: 5 new failures with `r.put is not a function` / `r.get is not a function`.

- [ ] **Step 3: Implement `put` and `get`**

Add these methods inside the `Ring` class in `src/core/ring.ts` (before the closing brace, after `addNode`):

```ts
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
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm run test -- ring
```

Expected: 14 passing (9 prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/core/ring.ts src/core/ring.test.ts
git commit -m "feat(core): add Ring.put and Ring.get"
```

---

### Task 6: Make `addNode` migrate existing keys; add `removeNode`

**Files:**
- Modify: `src/core/ring.ts`
- Modify: `src/core/ring.test.ts`

- [ ] **Step 1: Append failing tests for migration on add/remove**

Append to `src/core/ring.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm run test -- ring
```

Expected: failures in the new describe blocks (`r.removeNode is not a function`, migration count mismatch).

- [ ] **Step 3: Refactor — extract a private `rebalanceAll` helper, update `addNode`, add `removeNode`**

In `src/core/ring.ts`, add a private helper before `addNode`:

```ts
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
```

Replace the existing `addNode` body (the part after sorting tokens) with:

```ts
    const events: CoreEvent[] = [{ type: "NodeAdded", nodeId }];
    events.push(...this.rebalanceAll());
    return { events };
```

Then add `removeNode` immediately after `addNode`:

```ts
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
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm run test -- ring
```

Expected: 19 passing (14 prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/core/ring.ts src/core/ring.test.ts
git commit -m "feat(core): migrate keys on addNode/removeNode"
```

---

### Task 7: Add `setReplicationFactor` and `setVnodesPerNode`

**Files:**
- Modify: `src/core/ring.ts`
- Modify: `src/core/ring.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/core/ring.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npm run test -- ring
```

Expected: new failures with `setReplicationFactor is not a function` / `setVnodesPerNode is not a function`.

- [ ] **Step 3: Implement the two setters**

Add to `Ring` in `src/core/ring.ts`, after `removeNode`:

```ts
  setReplicationFactor(rf: number): OperationResult {
    if (!Number.isInteger(rf) || rf < 1) {
      throw new Error("replicationFactor must be an integer at least 1");
    }
    this.replicationFactor = rf;
    return { events: this.rebalanceAll() };
  }

  setVnodesPerNode(n: number): OperationResult {
    if (!Number.isInteger(n) || n < 1 || n > 64) {
      throw new Error("vnodesPerNode must be an integer between 1 and 64");
    }
    this.vnodesPerNode = n;
    // Rebuild every node's tokens from scratch.
    this.tokens = [];
    for (const nodeId of this.nodeIds) {
      for (let i = 0; i < n; i++) {
        this.tokens.push({ position: hashKey(`${nodeId}#${i}`), vnodeIndex: i, nodeId });
      }
    }
    this.tokens.sort((a, b) => a.position - b.position);
    return { events: this.rebalanceAll() };
  }
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm run test -- ring
```

Expected: 25 passing (19 prior + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/core/ring.ts src/core/ring.test.ts
git commit -m "feat(core): add setReplicationFactor and setVnodesPerNode"
```

---

## Phase 3 — State

### Task 8: Zustand store wrapping a `Ring` instance

**Files:**
- Create: `src/state/store.ts`

- [ ] **Step 1: Create the store**

```ts
import { create } from "zustand";
import { Ring } from "../core/ring";
import type { CoreEvent } from "../core/events";
import type { RingSnapshot } from "../core/types";

export type Speed = 0.25 | 0.5 | 1 | 2 | 4;

type State = {
  ring: Ring;
  snapshot: RingSnapshot;
  lastEvents: CoreEvent[];
  speed: Speed;
  stepMode: boolean;
};

type Actions = {
  addNode: () => void;
  removeNode: (nodeId: string) => void;
  put: (key: string, value: string) => void;
  get: (key: string) => void;
  setReplicationFactor: (rf: number) => void;
  setVnodesPerNode: (n: number) => void;
  setSpeed: (s: Speed) => void;
  toggleStepMode: () => void;
  reset: (seed: (r: Ring) => void) => void;
};

/**
 * Generates a fresh nodeId. Physical node ids are "N1", "N2", ... and increase
 * monotonically — they are never reused even after a node is removed, so the
 * palette assignment in palette.ts stays stable per node within a session.
 */
let nextNodeOrdinal = 1;
const allocateNodeId = (existing: string[]): string => {
  while (existing.includes(`N${nextNodeOrdinal}`)) nextNodeOrdinal++;
  return `N${nextNodeOrdinal++}`;
};

const INITIAL_VNODES = 16;
const INITIAL_RF = 3;

const makeInitialRing = (): Ring => {
  return new Ring({ vnodesPerNode: INITIAL_VNODES, replicationFactor: INITIAL_RF });
};

export const useRingStore = create<State & Actions>((set, get) => {
  const ring = makeInitialRing();

  const refresh = (events: CoreEvent[]) =>
    set({ snapshot: ring.snapshot(), lastEvents: events });

  return {
    ring,
    snapshot: ring.snapshot(),
    lastEvents: [],
    speed: 1,
    stepMode: false,

    addNode: () => {
      const { ring } = get();
      const id = allocateNodeId(ring.snapshot().nodeIds);
      const { events } = ring.addNode(id);
      refresh(events);
    },
    removeNode: (nodeId) => {
      const { ring } = get();
      const { events } = ring.removeNode(nodeId);
      refresh(events);
    },
    put: (key, value) => {
      const { ring } = get();
      const { events } = ring.put(key, value);
      refresh(events);
    },
    get: (key) => {
      const { ring } = get();
      const { events } = ring.get(key);
      refresh(events);
    },
    setReplicationFactor: (rf) => {
      const { ring } = get();
      const { events } = ring.setReplicationFactor(rf);
      refresh(events);
    },
    setVnodesPerNode: (n) => {
      const { ring } = get();
      const { events } = ring.setVnodesPerNode(n);
      refresh(events);
    },
    setSpeed: (s) => set({ speed: s }),
    toggleStepMode: () => set((s) => ({ stepMode: !s.stepMode })),

    reset: (seed) => {
      nextNodeOrdinal = 1;
      const fresh = makeInitialRing();
      seed(fresh);
      set({
        ring: fresh,
        snapshot: fresh.snapshot(),
        lastEvents: [],
        speed: 1,
        stepMode: false,
      });
    },
  };
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/state/store.ts
git commit -m "feat(state): add Zustand store wrapping Ring"
```

---

## Phase 4 — Support modules

### Task 9: Palette and animation constants

**Files:**
- Create: `src/lib/palette.ts`
- Create: `src/lib/animation.ts`

- [ ] **Step 1: Create the palette**

```ts
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
```

- [ ] **Step 2: Create animation constants**

```ts
// src/lib/animation.ts

/** Base durations in ms. All consumers multiply by the current store speed. */
export const DURATION = {
  calcFrame: 400,
  probeWalkPerToken: 90,
  keyDrop: 350,
  keyMigrate: 600,
  vnodeFanInPerToken: 50,
  cardEnter: 250,
  cardExit: 200,
} as const;

export const EASING = {
  default: [0.22, 1, 0.36, 1] as const, // ease-out cubic-ish (Framer "easeOut")
  drop: [0.34, 1.56, 0.64, 1] as const, // gentle overshoot for drops
};

/**
 * Helper for components: multiply a base duration by the current speed slider.
 * Speed = 4 means "play 4x as fast" — divide. Speed = 0.25 means "quarter speed" —
 * divide too (1 / 0.25 = 4x longer). So duration in seconds = base / 1000 / speed.
 */
export function scaledSeconds(baseMs: number, speed: number): number {
  return baseMs / 1000 / speed;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/palette.ts src/lib/animation.ts
git commit -m "feat(lib): add palette and animation constants"
```

---

## Phase 5 — Seed

### Task 10: Initial cluster seed

**Files:**
- Create: `src/seed.ts`

- [ ] **Step 1: Create the seed**

```ts
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
```

- [ ] **Step 2: Wire the seed into the store on first mount**

Edit `src/state/store.ts`. Change the bottom of the file from:

```ts
export const useRingStore = create<State & Actions>((set, get) => {
  const ring = makeInitialRing();
```

to:

```ts
import { applySeed } from "../seed";

export const useRingStore = create<State & Actions>((set, get) => {
  const ring = makeInitialRing();
  applySeed(ring);
```

(Just add the import line at the top of the import block and the `applySeed(ring);` call. Leave the rest of the file unchanged.)

Also update `reset` to call `applySeed` by default if no seed function is supplied. Change `reset` to:

```ts
    reset: (seed?: (r: Ring) => void) => {
      nextNodeOrdinal = 1;
      const fresh = makeInitialRing();
      (seed ?? applySeed)(fresh);
      // Advance the ordinal past whatever the seed used.
      nextNodeOrdinal = fresh.snapshot().nodeIds.length + 1;
      set({
        ring: fresh,
        snapshot: fresh.snapshot(),
        lastEvents: [],
        speed: 1,
        stepMode: false,
      });
    },
```

And update the `Actions` type for `reset`:

```ts
  reset: (seed?: (r: Ring) => void) => void;
```

After mounting the seeded ring, advance `nextNodeOrdinal` past the seed too:

```ts
  const ring = makeInitialRing();
  applySeed(ring);
  nextNodeOrdinal = ring.snapshot().nodeIds.length + 1;
```

- [ ] **Step 3: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/seed.ts src/state/store.ts
git commit -m "feat: seed initial cluster with four nodes and demo keys"
```

---

## Phase 6 — View (bottom-up, static rendering before animations)

### Task 11: App shell with three-pane layout

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useRingStore } from "./state/store";

export default function App() {
  const snapshot = useRingStore((s) => s.snapshot);

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-6 py-3">
        <h1 className="text-lg font-semibold">Consistent Hashing Demo</h1>
        <div className="ml-auto flex gap-4 text-xs text-neutral-400">
          <span>Nodes: {snapshot.nodeIds.length}</span>
          <span>RF: {snapshot.replicationFactor}</span>
          <span>vnodes/node: {snapshot.vnodesPerNode}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_320px]">
        <aside id="controls-pane" className="border-r border-neutral-800 p-4 overflow-y-auto">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Controls</p>
        </aside>

        <main id="ring-pane" className="relative min-h-0 overflow-hidden">
          <p className="absolute left-4 top-4 text-xs uppercase tracking-wider text-neutral-500">
            Ring
          </p>
        </main>

        <aside id="calc-pane" className="border-l border-neutral-800 p-4 overflow-y-auto">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Calculation</p>
        </aside>
      </div>

      <footer id="inspector-pane" className="border-t border-neutral-800 p-3">
        <p className="text-xs uppercase tracking-wider text-neutral-500">Nodes</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Run the dev server and confirm the shell renders**

```bash
npm run dev
```

Then in a separate terminal:

```bash
curl -s http://localhost:5173/ | grep -q '<div id="root"' && echo OK
```

Expected: `OK`. Open the URL in a browser and visually confirm: title at top, three columns + bottom strip, "Nodes: 4 RF: 3 vnodes/node: 16" in the header (from the seed). Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): add three-pane app shell"
```

---

### Task 12: NodeCard and NodeInspector (static)

**Files:**
- Create: `src/components/NodeCard.tsx`
- Create: `src/components/NodeInspector.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `NodeCard.tsx`**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { colorForNode } from "../lib/palette";
import type { RingSnapshot } from "../core/types";

type Props = {
  nodeId: string;
  snapshot: RingSnapshot;
  onRemove: () => void;
  canRemove: boolean;
};

export function NodeCard({ nodeId, snapshot, onRemove, canRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = colorForNode(nodeId);
  const stored = snapshot.data[nodeId] ?? {};
  const keys = Object.keys(stored).sort();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs min-w-[140px]"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold">{nodeId}</span>
        <span className="ml-auto text-neutral-400">{keys.length} keys</span>
      </div>
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-neutral-400 hover:text-neutral-100"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
        <button
          onClick={onRemove}
          disabled={!canRemove}
          className="ml-auto text-neutral-500 hover:text-red-400 disabled:opacity-30"
          title={canRemove ? "Remove node" : "Cluster must have at least one node"}
        >
          remove
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-[11px] text-neutral-300">
          {keys.length === 0 && <li className="text-neutral-600">no keys</li>}
          {keys.map((k) => (
            <li key={k} className="flex justify-between gap-2">
              <span className="truncate">{k}</span>
              <span className="text-neutral-500">{stored[k]}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Create `NodeInspector.tsx`**

```tsx
import { AnimatePresence } from "framer-motion";
import { useRingStore } from "../state/store";
import { NodeCard } from "./NodeCard";

export function NodeInspector() {
  const snapshot = useRingStore((s) => s.snapshot);
  const removeNode = useRingStore((s) => s.removeNode);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <AnimatePresence initial={false}>
        {snapshot.nodeIds.map((id) => (
          <NodeCard
            key={id}
            nodeId={id}
            snapshot={snapshot}
            onRemove={() => removeNode(id)}
            canRemove={snapshot.nodeIds.length > 1}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Wire `NodeInspector` into `App.tsx`**

In `src/App.tsx`, replace the contents of the `footer` element with:

```tsx
      <footer id="inspector-pane" className="border-t border-neutral-800 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Nodes</p>
        <NodeInspector />
      </footer>
```

And add the import at the top:

```tsx
import { NodeInspector } from "./components/NodeInspector";
```

- [ ] **Step 4: Run dev server and visually confirm**

```bash
npm run dev
```

Open in browser. Expected: bottom strip shows four `NodeCard`s (N1–N4), each with a distinct top-border color, each showing a non-zero key count. Clicking "Expand" reveals key/value rows. Clicking "remove" on one card removes it and the remaining cards' key counts increase (because the removed node's keys re-replicated).

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/NodeCard.tsx src/components/NodeInspector.tsx src/App.tsx
git commit -m "feat(ui): add NodeCard and NodeInspector"
```

---

### Task 13: RingCanvas — static SVG ring with vnodes

**Files:**
- Create: `src/components/RingCanvas.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `RingCanvas.tsx`**

```tsx
import { useRingStore } from "../state/store";
import { colorForNode } from "../lib/palette";

const RING_RADIUS = 180;
const VIEW = 480;
const CENTER = VIEW / 2;

/** Maps a 32-bit ring position to an angle in radians (0 at top, clockwise). */
function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}

function ringPoint(position: number, radius: number): { x: number; y: number } {
  const a = positionToAngle(position);
  return { x: CENTER + Math.cos(a) * radius, y: CENTER + Math.sin(a) * radius };
}

export function RingCanvas() {
  const snapshot = useRingStore((s) => s.snapshot);

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="absolute inset-0 m-auto h-full w-full"
      role="img"
      aria-label="Consistent hashing ring"
    >
      {/* Ring track */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RING_RADIUS}
        fill="none"
        stroke="#262626"
        strokeWidth={2}
      />

      {/* Vnode tokens */}
      {snapshot.tokens.map((t) => {
        const p = ringPoint(t.position, RING_RADIUS);
        const color = colorForNode(t.nodeId);
        return (
          <circle
            key={`${t.nodeId}#${t.vnodeIndex}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={color}
            stroke="#0a0a0a"
            strokeWidth={1}
          />
        );
      })}

      {/* Stored keys — render at their hash position, just inside the ring */}
      {Object.keys(snapshot.ownership).map((k) => {
        // The owner list is non-empty; pick the first owner's color for the dot.
        const owners = snapshot.ownership[k];
        if (!owners || owners.length === 0) return null;
        const color = colorForNode(owners[0]);
        // Hash the key the same way the core does — but to avoid importing
        // hashKey here, we use the ownership index proxy: place keys near
        // their first replica's first vnode. (Good enough for the static view.)
        const firstOwner = owners[0];
        const firstToken = snapshot.tokens.find((t) => t.nodeId === firstOwner);
        if (!firstToken) return null;
        const p = ringPoint(firstToken.position, RING_RADIUS - 12);
        return (
          <circle
            key={`k-${k}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={color}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Wire `RingCanvas` into the center pane**

In `src/App.tsx`, replace the contents of the `main#ring-pane` with:

```tsx
        <main id="ring-pane" className="relative min-h-0 overflow-hidden">
          <p className="absolute left-4 top-4 z-10 text-xs uppercase tracking-wider text-neutral-500">
            Ring
          </p>
          <RingCanvas />
        </main>
```

Add the import:

```tsx
import { RingCanvas } from "./components/RingCanvas";
```

- [ ] **Step 3: Run dev server and visually confirm**

```bash
npm run dev
```

Open in browser. Expected: center pane shows a circular ring with 64 small colored dots (4 nodes × 16 vnodes), color-matched to the cards below, plus a handful of smaller, semi-transparent dots representing keys. Removing a node should cause its vnodes to disappear from the ring.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/RingCanvas.tsx src/App.tsx
git commit -m "feat(ui): add static SVG RingCanvas with vnodes and key dots"
```

---

### Task 14: ControlsPanel — buttons, sliders, PUT/GET form (no animations yet)

**Files:**
- Create: `src/components/ControlsPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `ControlsPanel.tsx`**

```tsx
import { useState } from "react";
import { useRingStore, type Speed } from "../state/store";

const SPEEDS: Speed[] = [0.25, 0.5, 1, 2, 4];

export function ControlsPanel() {
  const snapshot = useRingStore((s) => s.snapshot);
  const addNode = useRingStore((s) => s.addNode);
  const put = useRingStore((s) => s.put);
  const get = useRingStore((s) => s.get);
  const setRF = useRingStore((s) => s.setReplicationFactor);
  const setVnodes = useRingStore((s) => s.setVnodesPerNode);
  const speed = useRingStore((s) => s.speed);
  const setSpeed = useRingStore((s) => s.setSpeed);
  const stepMode = useRingStore((s) => s.stepMode);
  const toggleStepMode = useRingStore((s) => s.toggleStepMode);

  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const nodeCount = snapshot.nodeIds.length;
  const atNodeCap = nodeCount >= 12;
  const rfClamped = snapshot.replicationFactor > nodeCount;

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Cluster</p>
        <div className="flex gap-2">
          <button
            onClick={addNode}
            disabled={atNodeCap}
            className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 hover:bg-neutral-700 disabled:opacity-40"
            title={atNodeCap ? "Cluster cap: 12 nodes" : "Add node"}
          >
            + Add node
          </button>
        </div>

        <label className="mt-3 block">
          <div className="mb-1 flex justify-between text-xs text-neutral-400">
            <span>Replication factor</span>
            <span>
              {snapshot.replicationFactor}
              {rfClamped && (
                <span className="ml-1 text-amber-400">→ effective {nodeCount}</span>
              )}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={snapshot.replicationFactor}
            onChange={(e) => setRF(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </label>

        <label className="mt-3 block">
          <div className="mb-1 flex justify-between text-xs text-neutral-400">
            <span>vnodes per node</span>
            <span>{snapshot.vnodesPerNode}</span>
          </div>
          <input
            type="range"
            min={1}
            max={64}
            step={1}
            value={snapshot.vnodesPerNode}
            onChange={(e) => setVnodes(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </label>
      </section>

      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Operation</p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key"
          className="mb-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          className="mb-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
        />
        <div className="flex gap-2">
          <button
            onClick={() => put(key, value)}
            disabled={key.length === 0 || nodeCount === 0}
            className="flex-1 rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 hover:bg-emerald-900/60 disabled:opacity-40"
          >
            PUT
          </button>
          <button
            onClick={() => get(key)}
            disabled={key.length === 0 || nodeCount === 0}
            className="flex-1 rounded border border-blue-700 bg-blue-900/30 px-2 py-1 hover:bg-blue-900/60 disabled:opacity-40"
          >
            GET
          </button>
        </div>
        {nodeCount === 0 && (
          <p className="mt-2 text-xs text-amber-400">Add a node first.</p>
        )}
      </section>

      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Pacing</p>
        <div className="flex flex-wrap gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={
                "rounded border px-2 py-0.5 text-xs " +
                (speed === s
                  ? "border-neutral-300 bg-neutral-200 text-neutral-900"
                  : "border-neutral-700 hover:bg-neutral-800")
              }
            >
              {s}×
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={stepMode}
            onChange={toggleStepMode}
          />
          Step through calc panel manually
        </label>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `App.tsx`**

In `src/App.tsx`, replace the `aside#controls-pane` contents with:

```tsx
        <aside id="controls-pane" className="border-r border-neutral-800 p-4 overflow-y-auto">
          <p className="mb-3 text-xs uppercase tracking-wider text-neutral-500">Controls</p>
          <ControlsPanel />
        </aside>
```

Add the import:

```tsx
import { ControlsPanel } from "./components/ControlsPanel";
```

- [ ] **Step 3: Run dev server and validate flows**

```bash
npm run dev
```

In browser, exercise:
1. Click "+ Add node" repeatedly until it disables at 12. A new card and 16 new vnodes appear on the ring each click.
2. Slide RF up past nodeCount; observe the "→ effective N" amber hint.
3. Slide vnodes per node up; observe ring becomes denser.
4. Type `key: hello`, `value: world`, click PUT; observe a new key dot on the ring and key counts incrementing on RF cards. Click GET with the same key; nothing visible yet (no animation), but no errors in devtools console.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ControlsPanel.tsx src/App.tsx
git commit -m "feat(ui): add ControlsPanel (cluster / operation / pacing)"
```

---

### Task 15: CalcPanel — stepwise hash reveal (event-driven, no ring sync yet)

**Files:**
- Create: `src/components/CalcPanel.tsx`
- Modify: `src/App.tsx`

The CalcPanel watches `lastEvents` for a `KeyWritten` or `KeyRead` and steps through four frames. In Task 16 we'll add the ring probe; here we just render the panel content with animated frame reveal.

- [ ] **Step 1: Create `CalcPanel.tsx`**

```tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRingStore } from "../state/store";
import { DURATION, scaledSeconds } from "../lib/animation";
import type { HashTrace } from "../core/events";

type ActiveOp = { kind: "PUT" | "GET"; trace: HashTrace; value: string | undefined };

export function CalcPanel() {
  const lastEvents = useRingStore((s) => s.lastEvents);
  const speed = useRingStore((s) => s.speed);
  const stepMode = useRingStore((s) => s.stepMode);

  const [op, setOp] = useState<ActiveOp | null>(null);
  const [frame, setFrame] = useState(0);

  // When a new KeyWritten or KeyRead event arrives, start playing from frame 0.
  useEffect(() => {
    for (let i = lastEvents.length - 1; i >= 0; i--) {
      const e = lastEvents[i];
      if (e.type === "KeyWritten") {
        setOp({ kind: "PUT", trace: e.trace, value: e.value });
        setFrame(0);
        return;
      }
      if (e.type === "KeyRead") {
        setOp({ kind: "GET", trace: e.trace, value: e.value });
        setFrame(0);
        return;
      }
    }
  }, [lastEvents]);

  // Auto-advance frames unless step mode is on.
  useEffect(() => {
    if (!op) return;
    if (frame >= 3) return;
    if (stepMode) return;
    const id = setTimeout(
      () => setFrame((f) => f + 1),
      scaledSeconds(DURATION.calcFrame, speed) * 1000
    );
    return () => clearTimeout(id);
  }, [op, frame, stepMode, speed]);

  if (!op) {
    return (
      <p className="text-xs text-neutral-500">
        Trigger a PUT or GET to see the calculation.
      </p>
    );
  }

  const { trace, kind, value } = op;
  const hex = trace.digest.toString(16).padStart(8, "0").toUpperCase();
  const angleDeg = ((trace.position / 2 ** 32) * 360).toFixed(2);

  return (
    <div className="space-y-3 text-xs">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">
        {kind} <span className="text-neutral-300">{trace.key}</span>
      </p>

      <Frame visible={frame >= 0} label="1. Key bytes (UTF-8)">
        <code className="block break-all rounded bg-neutral-900 p-2">
          {trace.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")}
        </code>
      </Frame>

      <Frame visible={frame >= 1} label="2. FNV-1a digest">
        <code className="block rounded bg-neutral-900 p-2">0x{hex}</code>
      </Frame>

      <Frame visible={frame >= 2} label="3. Ring position">
        <code className="block rounded bg-neutral-900 p-2">{angleDeg}° on the ring</code>
      </Frame>

      <Frame visible={frame >= 3} label="4. Replica walk">
        <ol className="list-decimal space-y-1 rounded bg-neutral-900 p-2 pl-6">
          {trace.replicas.map((id) => (
            <li key={id}>
              <code>{id}</code>
            </li>
          ))}
        </ol>
        {kind === "GET" && (
          <p className="mt-2 text-neutral-300">
            Result: <code>{value === undefined ? "<not found>" : value}</code>
          </p>
        )}
      </Frame>

      {stepMode && frame < 3 && (
        <button
          onClick={() => setFrame((f) => f + 1)}
          className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
        >
          Next step →
        </button>
      )}
    </div>
  );
}

function Frame({
  visible,
  label,
  children,
}: {
  visible: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <p className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">
            {label}
          </p>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire `CalcPanel` into the right pane**

In `src/App.tsx`, replace the `aside#calc-pane` contents with:

```tsx
        <aside id="calc-pane" className="border-l border-neutral-800 p-4 overflow-y-auto">
          <p className="mb-3 text-xs uppercase tracking-wider text-neutral-500">Calculation</p>
          <CalcPanel />
        </aside>
```

Add the import:

```tsx
import { CalcPanel } from "./components/CalcPanel";
```

- [ ] **Step 3: Run dev server and validate the stepwise reveal**

```bash
npm run dev
```

In browser, type a key/value and click PUT. Expected: right pane reveals four frames in sequence at ~400 ms each. Click GET on an existing key; same flow, ending with `Result: <value>`. Toggle "Step through calc panel manually" and run PUT again; observe a "Next step →" button appears and frames advance only on click.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/CalcPanel.tsx src/App.tsx
git commit -m "feat(ui): add CalcPanel with stepwise hash reveal"
```

---

### Task 16: Ring probe — sync with calc panel during PUT/GET

**Files:**
- Modify: `src/components/RingCanvas.tsx`

The probe is a glowing dot that appears at the hashed position when frame 3 of the calc panel renders, then walks clockwise during frame 4. We piggyback on the same `lastEvents` signal the CalcPanel uses, plus a shared timing model.

- [ ] **Step 1: Add the probe to `RingCanvas.tsx`**

Replace `src/components/RingCanvas.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRingStore } from "../state/store";
import { colorForNode } from "../lib/palette";
import { DURATION, scaledSeconds } from "../lib/animation";
import type { HashTrace } from "../core/events";

const RING_RADIUS = 180;
const VIEW = 480;
const CENTER = VIEW / 2;

function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}
function ringPoint(position: number, radius: number): { x: number; y: number } {
  const a = positionToAngle(position);
  return { x: CENTER + Math.cos(a) * radius, y: CENTER + Math.sin(a) * radius };
}

type Probe = { trace: HashTrace; spawnedAt: number };

export function RingCanvas() {
  const snapshot = useRingStore((s) => s.snapshot);
  const lastEvents = useRingStore((s) => s.lastEvents);
  const speed = useRingStore((s) => s.speed);

  const [probe, setProbe] = useState<Probe | null>(null);

  // Spawn a probe when the most recent op is PUT or GET.
  useEffect(() => {
    for (let i = lastEvents.length - 1; i >= 0; i--) {
      const e = lastEvents[i];
      if (e.type === "KeyWritten" || e.type === "KeyRead") {
        setProbe({ trace: e.trace, spawnedAt: Date.now() });
        return;
      }
    }
  }, [lastEvents]);

  // Auto-clear the probe after the walk + drop completes.
  useEffect(() => {
    if (!probe) return;
    const totalMs =
      DURATION.calcFrame * 3 + // wait for frame 3 to land
      DURATION.probeWalkPerToken * Math.max(probe.trace.replicas.length, 1) * 4 +
      DURATION.keyDrop;
    const id = setTimeout(() => setProbe(null), totalMs / speed);
    return () => clearTimeout(id);
  }, [probe, speed]);

  const probePoint = probe ? ringPoint(probe.trace.position, RING_RADIUS) : null;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="absolute inset-0 m-auto h-full w-full"
      role="img"
      aria-label="Consistent hashing ring"
    >
      <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} fill="none" stroke="#262626" strokeWidth={2} />

      {snapshot.tokens.map((t) => {
        const p = ringPoint(t.position, RING_RADIUS);
        const color = colorForNode(t.nodeId);
        const isReplica = probe?.trace.replicas.includes(t.nodeId) ?? false;
        return (
          <motion.circle
            key={`${t.nodeId}#${t.vnodeIndex}`}
            cx={p.x}
            cy={p.y}
            r={isReplica ? 6 : 4}
            fill={color}
            stroke="#0a0a0a"
            strokeWidth={1}
            initial={{ r: 0 }}
            animate={{ r: isReplica ? 6 : 4 }}
            transition={{ duration: scaledSeconds(DURATION.vnodeFanInPerToken, speed) }}
          />
        );
      })}

      {Object.keys(snapshot.ownership).map((k) => {
        const owners = snapshot.ownership[k];
        if (!owners || owners.length === 0) return null;
        const color = colorForNode(owners[0]);
        const firstOwner = owners[0];
        const firstToken = snapshot.tokens.find((t) => t.nodeId === firstOwner);
        if (!firstToken) return null;
        const p = ringPoint(firstToken.position, RING_RADIUS - 12);
        return <circle key={`k-${k}`} cx={p.x} cy={p.y} r={2.5} fill={color} opacity={0.7} />;
      })}

      {/* Probe */}
      <AnimatePresence>
        {probePoint && probe && (
          <motion.circle
            key={`probe-${probe.spawnedAt}`}
            r={7}
            fill="#ffffff"
            fillOpacity={0.85}
            initial={{ cx: probePoint.x, cy: probePoint.y, opacity: 0 }}
            animate={{
              cx: ringPoint(
                snapshot.tokens.find((t) => t.nodeId === probe.trace.replicas[probe.trace.replicas.length - 1])
                  ?.position ?? probe.trace.position,
                RING_RADIUS
              ).x,
              cy: ringPoint(
                snapshot.tokens.find((t) => t.nodeId === probe.trace.replicas[probe.trace.replicas.length - 1])
                  ?.position ?? probe.trace.position,
                RING_RADIUS
              ).y,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: scaledSeconds(
                DURATION.probeWalkPerToken * Math.max(probe.trace.replicas.length, 1) * 4,
                speed
              ),
              delay: scaledSeconds(DURATION.calcFrame * 2, speed),
              times: [0, 0.05, 0.85, 1],
            }}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}
```

- [ ] **Step 2: Visual validate**

```bash
npm run dev
```

Click PUT with key `hello`, value `world`. Expected: as the calc panel reaches frame 3 (Ring position), a white probe dot appears on the ring at the corresponding position; during frame 4 (Replica walk) it travels clockwise toward the final replica's vnode; the chosen replica vnodes briefly grow slightly larger. Run GET; same behavior.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/RingCanvas.tsx
git commit -m "feat(ui): probe animation synced with calc panel"
```

---

### Task 17: Key drop animation onto inspector cards after PUT

**Files:**
- Modify: `src/components/RingCanvas.tsx`
- Modify: `src/components/NodeCard.tsx`

The "drop" is a colored dot that originates at the ring position and animates toward each replica card's position in the DOM, then fades into the card. We use the simpler approach: render the drop dots inside the SVG, ending at screen coordinates measured from the card's bounding box translated into SVG-coordinate space.

Because mixing screen coordinates and SVG viewBox is fragile, we instead render the drops as absolutely-positioned `<div>`s over the whole layout, using `framer-motion`'s `motion.div` to animate between two screen-space points. This sidesteps the SVG coordinate translation entirely.

- [ ] **Step 1: Add a `data-node-card-id` attribute to `NodeCard.tsx`**

In `src/components/NodeCard.tsx`, change the outer `<motion.div>` to include `data-node-card-id={nodeId}`:

```tsx
    <motion.div
      data-node-card-id={nodeId}
      layout
      initial={{ opacity: 0, y: 8 }}
      // ...rest unchanged
```

- [ ] **Step 2: Add a drop overlay layer**

Create `src/components/DropOverlay.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRingStore } from "../state/store";
import { colorForNode } from "../lib/palette";
import { DURATION, scaledSeconds } from "../lib/animation";

type Drop = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
};

const RING_RADIUS = 180;
const VIEW = 480;
const CENTER = VIEW / 2;

function positionToAngle(position: number): number {
  return (position / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
}

/** Converts a ring position to screen coordinates by reading the live SVG element. */
function ringPositionToScreen(position: number): { x: number; y: number } | null {
  const svg = document.querySelector("svg[aria-label='Consistent hashing ring']") as SVGSVGElement | null;
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  // The SVG uses viewBox 0 0 480 480 with preserveAspectRatio default (xMidYMid meet).
  // Within the rendered SVG box, the viewBox is centered. Compute scale and offsets.
  const scale = Math.min(rect.width / VIEW, rect.height / VIEW);
  const drawnW = VIEW * scale;
  const drawnH = VIEW * scale;
  const offsetX = rect.left + (rect.width - drawnW) / 2;
  const offsetY = rect.top + (rect.height - drawnH) / 2;
  const a = positionToAngle(position);
  const vbX = CENTER + Math.cos(a) * RING_RADIUS;
  const vbY = CENTER + Math.sin(a) * RING_RADIUS;
  return { x: offsetX + vbX * scale, y: offsetY + vbY * scale };
}

function cardCenter(nodeId: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-node-card-id="${nodeId}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function DropOverlay() {
  const lastEvents = useRingStore((s) => s.lastEvents);
  const speed = useRingStore((s) => s.speed);
  const seenRef = useRef<number>(0);
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    // Process every event added since last render.
    const start = seenRef.current;
    seenRef.current = lastEvents.length;
    const ringDelay = scaledSeconds(DURATION.calcFrame * 3, speed) * 1000;

    const newDrops: Drop[] = [];
    for (let i = start; i < lastEvents.length; i++) {
      const e = lastEvents[i];
      if (e.type !== "KeyWritten") continue;
      const from = ringPositionToScreen(e.trace.position);
      if (!from) continue;
      for (const replica of e.trace.replicas) {
        const to = cardCenter(replica);
        if (!to) continue;
        newDrops.push({
          id: `${e.trace.key}-${replica}-${Date.now()}-${Math.random()}`,
          from,
          to,
          color: colorForNode(replica),
        });
      }
    }
    if (newDrops.length === 0) return;
    // Delay spawning until the probe walk completes, then auto-clear after the drop duration.
    const totalDelay = ringDelay;
    const id = setTimeout(() => setDrops((d) => [...d, ...newDrops]), totalDelay);
    return () => clearTimeout(id);
  }, [lastEvents, speed]);

  // Garbage-collect drops shortly after their animation finishes.
  useEffect(() => {
    if (drops.length === 0) return;
    const id = setTimeout(
      () => setDrops([]),
      scaledSeconds(DURATION.keyDrop, speed) * 1000 + 200
    );
    return () => clearTimeout(id);
  }, [drops, speed]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {drops.map((d) => (
          <motion.div
            key={d.id}
            initial={{ x: d.from.x, y: d.from.y, opacity: 0.9, scale: 1 }}
            animate={{ x: d.to.x, y: d.to.y, opacity: 0, scale: 0.6 }}
            transition={{ duration: scaledSeconds(DURATION.keyDrop, speed), ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: "absolute",
              left: -5,
              top: -5,
              width: 10,
              height: 10,
              borderRadius: "9999px",
              background: d.color,
              boxShadow: `0 0 8px ${d.color}`,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Mount `DropOverlay` in `App.tsx`**

In `src/App.tsx`, add the import:

```tsx
import { DropOverlay } from "./components/DropOverlay";
```

And add `<DropOverlay />` as the last child of the outer flex `<div>`:

```tsx
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      {/* ...header, grid, footer... */}
      <DropOverlay />
    </div>
```

- [ ] **Step 4: Visual validate**

```bash
npm run dev
```

PUT a key. Expected: after the probe walk, 3 colored dots (RF=3) fly out from the ring position and land on the corresponding inspector cards. Card key counts increment as the dots arrive.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/NodeCard.tsx src/components/DropOverlay.tsx src/App.tsx
git commit -m "feat(ui): key drop overlay from ring to inspector cards on PUT"
```

---

### Task 18: Migration animation on add/remove node and slider changes

**Files:**
- Modify: `src/components/DropOverlay.tsx`

We extend `DropOverlay` to also render `KeyMigrated` events as card-to-card flights. The geometry uses `cardCenter` twice — once for `from` (old owner), once for `to` (new owner).

- [ ] **Step 1: Extend `DropOverlay.tsx`**

Replace the body of the first `useEffect` in `src/components/DropOverlay.tsx` with:

```ts
  useEffect(() => {
    const start = seenRef.current;
    seenRef.current = lastEvents.length;

    const writeDelay = scaledSeconds(DURATION.calcFrame * 3, speed) * 1000;
    const migrateDelay = 0; // migrations fire immediately

    const writeDrops: Drop[] = [];
    const migrateDrops: Drop[] = [];

    for (let i = start; i < lastEvents.length; i++) {
      const e = lastEvents[i];
      if (e.type === "KeyWritten") {
        const from = ringPositionToScreen(e.trace.position);
        if (!from) continue;
        for (const replica of e.trace.replicas) {
          const to = cardCenter(replica);
          if (!to) continue;
          writeDrops.push({
            id: `w-${e.trace.key}-${replica}-${Date.now()}-${Math.random()}`,
            from,
            to,
            color: colorForNode(replica),
          });
        }
      } else if (e.type === "KeyMigrated") {
        // For each *new* owner that wasn't in the old set, fly a dot from any
        // remaining old owner (or the first old owner if none persist).
        const newOwners = e.to.filter((n) => !e.from.includes(n));
        const sourceOwner = e.from.find((n) => e.to.includes(n)) ?? e.from[0];
        const fromPt = sourceOwner ? cardCenter(sourceOwner) : null;
        for (const dest of newOwners) {
          const toPt = cardCenter(dest);
          if (!fromPt || !toPt) continue;
          migrateDrops.push({
            id: `m-${e.key}-${dest}-${Date.now()}-${Math.random()}`,
            from: fromPt,
            to: toPt,
            color: colorForNode(dest),
          });
        }
      }
    }

    if (writeDrops.length === 0 && migrateDrops.length === 0) return;

    const timers: number[] = [];
    if (migrateDrops.length > 0) {
      const id = window.setTimeout(
        () => setDrops((d) => [...d, ...migrateDrops]),
        migrateDelay
      );
      timers.push(id);
    }
    if (writeDrops.length > 0) {
      const id = window.setTimeout(
        () => setDrops((d) => [...d, ...writeDrops]),
        writeDelay
      );
      timers.push(id);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [lastEvents, speed]);
```

Also update the per-drop transition: migrations use `DURATION.keyMigrate`, writes use `DURATION.keyDrop`. Tag each drop with its base duration. Modify the `Drop` type:

```ts
type Drop = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  durationMs: number;
};
```

In the loop, set `durationMs: DURATION.keyDrop` on writeDrops and `durationMs: DURATION.keyMigrate` on migrateDrops.

Update the rendered `motion.div`'s `transition.duration` to use `scaledSeconds(d.durationMs, speed)`:

```tsx
            transition={{ duration: scaledSeconds(d.durationMs, speed), ease: [0.34, 1.56, 0.64, 1] }}
```

And the auto-clear effect at the bottom: use the max durationMs in `drops`:

```ts
  useEffect(() => {
    if (drops.length === 0) return;
    const maxMs = Math.max(...drops.map((d) => d.durationMs));
    const id = setTimeout(
      () => setDrops([]),
      scaledSeconds(maxMs, speed) * 1000 + 200
    );
    return () => clearTimeout(id);
  }, [drops, speed]);
```

- [ ] **Step 2: Visual validate**

```bash
npm run dev
```

1. Click "+ Add node". Expected: a new card slides into the inspector strip and a flurry of colored dots fly from existing cards to the new card (one per migrated key).
2. Click "remove" on a card with several keys. Expected: dots fly from that card to its successor cards before the card disappears.
3. Slide RF or vnodes-per-node. Expected: dots fly between cards proportional to the rebalance churn.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/DropOverlay.tsx
git commit -m "feat(ui): migration animation for add/remove/slider rebalance"
```

---

### Task 19: Hover affordances — node→vnode pulse, key→arc

**Files:**
- Modify: `src/components/RingCanvas.tsx`
- Modify: `src/components/NodeCard.tsx`
- Create: `src/state/hover.ts`

We add a tiny side store for transient hover state so `RingCanvas` can react to hovers in `NodeCard` without prop-drilling.

- [ ] **Step 1: Create the hover store**

```ts
// src/state/hover.ts
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
```

- [ ] **Step 2: Wire hover handlers in `NodeCard.tsx`**

Add to the imports:

```tsx
import { useHoverStore } from "../state/hover";
```

Inside the `NodeCard` component body, grab the setters:

```tsx
  const setHoveredNode = useHoverStore((s) => s.setHoveredNode);
  const setHoveredKey = useHoverStore((s) => s.setHoveredKey);
```

Add `onMouseEnter` / `onMouseLeave` to the outer `motion.div`:

```tsx
      onMouseEnter={() => setHoveredNode(nodeId)}
      onMouseLeave={() => setHoveredNode(null)}
```

And on each key `<li>` in the expanded list:

```tsx
            <li
              key={k}
              onMouseEnter={() => setHoveredKey(k)}
              onMouseLeave={() => setHoveredKey(null)}
              className="flex justify-between gap-2"
            >
```

- [ ] **Step 3: React to hover in `RingCanvas.tsx`**

Add to the imports:

```tsx
import { useHoverStore } from "../state/hover";
import { hashKey } from "../core/hash";
```

Inside `RingCanvas`, read hover state:

```tsx
  const hoveredNodeId = useHoverStore((s) => s.hoveredNodeId);
  const hoveredKey = useHoverStore((s) => s.hoveredKey);
```

Modify the vnode `<motion.circle>` render: when `hoveredNodeId === t.nodeId`, animate `r` to `7` and add a subtle glow via `stroke` color:

```tsx
        const isHoveredNode = hoveredNodeId === t.nodeId;
        return (
          <motion.circle
            key={`${t.nodeId}#${t.vnodeIndex}`}
            cx={p.x}
            cy={p.y}
            fill={color}
            stroke={isHoveredNode ? "#ffffff" : "#0a0a0a"}
            strokeWidth={isHoveredNode ? 1.5 : 1}
            animate={{ r: isReplica || isHoveredNode ? 7 : 4 }}
            transition={{ duration: 0.18 }}
          />
        );
```

Add a `<g>` for hovered-key arcs after the tokens, before the probe block:

```tsx
      {hoveredKey && snapshot.ownership[hoveredKey] && (
        <g>
          {(() => {
            const keyHash = hashKey(hoveredKey);
            const keyPt = ringPoint(keyHash, RING_RADIUS - 12);
            const owners = snapshot.ownership[hoveredKey] ?? [];
            return owners.map((ownerId) => {
              // Pick the owner's vnode whose position is closest clockwise from the key.
              const candidates = snapshot.tokens.filter((t) => t.nodeId === ownerId);
              if (candidates.length === 0) return null;
              const best = candidates.reduce((acc, t) => {
                const dist = (t.position - keyHash + 2 ** 32) % 2 ** 32;
                return dist < acc.dist ? { t, dist } : acc;
              }, { t: candidates[0], dist: (candidates[0].position - keyHash + 2 ** 32) % 2 ** 32 });
              const ownerPt = ringPoint(best.t.position, RING_RADIUS);
              return (
                <line
                  key={`arc-${hoveredKey}-${ownerId}`}
                  x1={keyPt.x}
                  y1={keyPt.y}
                  x2={ownerPt.x}
                  y2={ownerPt.y}
                  stroke="#ffffff"
                  strokeOpacity={0.5}
                  strokeWidth={1.2}
                />
              );
            });
          })()}
        </g>
      )}
```

- [ ] **Step 4: Visual validate**

```bash
npm run dev
```

Hover a `NodeCard`: its vnodes on the ring grow to r=7 with a white outline. Expand a card and hover one of its key rows: thin white lines appear from that key's ring position to each replica vnode.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/state/hover.ts src/components/NodeCard.tsx src/components/RingCanvas.tsx
git commit -m "feat(ui): hover affordances for node→vnode and key→arc"
```

---

## Phase 7 — Polish & verification

### Task 20: UI smoke test

**Files:**
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write the smoke test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App smoke", () => {
  it("renders the header and the seeded node cards", () => {
    render(<App />);
    expect(screen.getByText(/Consistent Hashing Demo/i)).toBeInTheDocument();
    // Seed creates N1..N4.
    expect(screen.getByText("N1")).toBeInTheDocument();
    expect(screen.getByText("N2")).toBeInTheDocument();
    expect(screen.getByText("N3")).toBeInTheDocument();
    expect(screen.getByText("N4")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm run test
```

Expected: all tests pass — 25 from `ring.test.ts` + 5 from `hash.test.ts` + 1 from `App.test.tsx` = **31 passing**.

- [ ] **Step 3: Run a production build**

```bash
npm run build
```

Expected: builds cleanly with no TypeScript errors and emits `dist/`.

- [ ] **Step 4: Commit**

```bash
git add src/App.test.tsx
git commit -m "test(ui): smoke test renders App with seeded cluster"
```

---

### Task 21: README walkthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
# Consistent Hashing Demo

Interactive, browser-only visualization of Cassandra/DynamoDB-style consistent hashing.
Add and remove nodes, change the replication factor and vnodes-per-node, write and read
keys, and watch every step of the hash → ring-position → replica-walk calculation play
out in animation.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed localhost URL.

## What you'll see

- A ring with 16 vnode tokens per physical node, each token colored by its physical node.
- Four pre-seeded nodes (N1–N4) and eight demo keys on first load.
- Left pane: cluster controls (add, RF slider, vnodes slider) and operation form (PUT/GET).
- Center pane: the ring, animated probes, and key markers.
- Right pane: a four-frame stepwise hash calculation.
- Bottom strip: one card per node, expandable to show the keys it stores. Hover a card
  to highlight its vnodes; hover a key row to see lines from the key's ring position
  to its replicas.

## Test

```bash
npm run test
```

Covers the core: FNV-1a hash vectors, ring sort invariants, replica selection,
duplicate-physical-node skipping, effective-RF clamping, key migration on
add/remove/slider, and a UI smoke test.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README walkthrough"
```

---

### Task 22: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: 31 passing.

- [ ] **Step 2: Run a production build**

```bash
npm run build
```

Expected: success, no errors.

- [ ] **Step 3: Manually validate every operation in dev**

```bash
npm run dev
```

Walk through this checklist in the browser:

- [ ] PUT a new key — see calc frames step through, probe walk, key drops onto RF cards.
- [ ] GET an existing key — see calc frames, probe walk, result appears in calc panel.
- [ ] GET a missing key — result row reads `<not found>`.
- [ ] Click "+ Add node" — new card slides in, migration dots fly to it, ring densifies.
- [ ] Click "remove" on a node — migration dots leave it, card disappears.
- [ ] Slide RF up — replication widens (or hint amber appears if RF > nodeCount).
- [ ] Slide vnodes/node — ring re-densifies, migration dots fly.
- [ ] Switch speed to 0.25× — animations slow visibly; switch to 4× — they speed up.
- [ ] Toggle "Step through calc panel manually" — frames advance only on click.
- [ ] Hover a card — its vnodes pulse on the ring.
- [ ] Expand a card, hover a key — arcs appear from key position to replica vnodes.
- [ ] Try to remove the last remaining node — button is disabled.
- [ ] Add nodes until cap — "+ Add node" disables at 12.

Stop the dev server.

- [ ] **Step 4: Final commit if any tweaks were needed**

If manual validation surfaced any minor issues, fix them, commit with a message describing the fix, and re-run validation. Otherwise, you're done.
