# Consistent Hashing Demo — Design

**Date:** 2026-05-27
**Status:** Approved for planning

## Purpose

An interactive, browser-only demonstration of Cassandra/DynamoDB-style consistent hashing. The number of physical nodes, the per-node virtual-node count, and the replication factor are all user-controllable. Reads and writes are animated step-by-step so the user can see exactly which calculation determined where a key lives. The project is a teaching tool; visualization fidelity matters more than system-level realism.

## Scope

**In scope:**

- Plain consistent hashing with virtual nodes and a configurable replication factor (RF).
- Six operations: add node, remove node, write key (PUT), read key (GET), change vnodes-per-node, change RF.
- Stepwise visualization of the hash → ring-position → replica-walk calculation.
- Animated key migration on every cluster-shape change.
- A pre-seeded initial cluster so the first thing the user sees is a working ring.

**Out of scope:**

- Deletes (PUT-tombstones).
- Node failure simulation distinct from graceful removal.
- Quorum reads/writes.
- Multi-datacenter / rack awareness.
- Persistence across page reloads.
- Networked backend.
- WCAG-grade accessibility (visualization is inherently visual).

## Stack

- **React + Vite + TypeScript** — instant HMR, near-zero config, strong types for the ring data model.
- **Framer Motion** — SVG ring animations and FLIP-style layout transitions on the inspector cards.
- **Tailwind CSS** — fast utility-first styling.
- **Zustand** — single thin store wrapping a `Ring` instance.
- **Vitest** — test runner for the core layer.

## Architecture

Three strictly separated layers. The boundary rule is: **`core/` never imports from `state/` or `components/`; `components/` never mutates ring state directly.** Everything flows through Zustand actions that call core methods.

### Core (pure, no UI) — `src/core/`

- **`hash.ts`** — FNV-1a 32-bit hash. Single function `hashKey(s: string): number`. Pure, deterministic, tested in isolation.
- **`ring.ts`** — ring data structure and all consistent-hashing logic. Public operations:
  - `addNode(id)`
  - `removeNode(id)`
  - `setReplicationFactor(rf)`
  - `setVnodesPerNode(n)`
  - `put(key, value)`
  - `get(key)`
  - `lookupReplicas(keyHash): nodeId[]`
- **`events.ts`** — narrow event union: `NodeAdded`, `NodeRemoved`, `KeyMigrated`, `KeyWritten`, `KeyRead`. Operations return both new state *and* an event list, so the UI knows precisely what to animate.
- **`types.ts`** — shared types (`Token`, `NodeId`, `RingState`, etc.).

### State (thin) — `src/state/`

- **`store.ts`** — Zustand store wrapping a `Ring` instance. Holds the current state plus the most recent event list from the latest operation. Components subscribe to slices.

### View — `src/components/`

- **`App.tsx`** — three-pane shell (IDE-style layout).
- **`RingCanvas.tsx`** — SVG ring, vnode tokens, key markers, animated probe and migration dots.
- **`ControlsPanel.tsx`** — left pane: add/remove node buttons, RF slider, vnodes/node slider, PUT/GET form, animation-speed slider, step-mode toggle.
- **`CalcPanel.tsx`** — right pane: four-frame stepwise hash calculation reveal, replica list result row.
- **`NodeInspector.tsx`** — bottom strip: one `NodeCard` per physical node, expandable to show its stored keys.
- **`NodeCard.tsx`** — single node card; reflows under `LayoutGroup` when peers add/remove.

### Support — `src/lib/`

- **`palette.ts`** — 12-color qualitative palette plus the assignment function that gives each new physical node a stable color.
- **`animation.ts`** — shared easing curves and base duration constants. All durations are multiplied by the current speed factor before being passed to Framer Motion.

### Top-level — `src/`

- **`seed.ts`** — initial 4-node cluster plus a handful of demo keys loaded on first paint.
- **`main.tsx`**, **`App.css`**.

## Data model & ring math

- **Ring size:** `2^32` positions. Hash output is treated as 32-bit unsigned. Visually mapped to angle `0–360°` on the SVG.
- **Vnode tokens:** for each physical node `nodeId`, generate `vnodesPerNode` tokens with position `hashKey(\`${nodeId}#${i}\`)` for `i ∈ [0, vnodesPerNode)`. Stored as a single sorted array `tokens: { position: number; nodeId: string }[]`.
- **Replica selection:** given key `k`:
  1. Compute `h = hashKey(k)`.
  2. Binary-search `tokens` for the first token with `position >= h`; wrap to index 0 if past the end.
  3. Walk clockwise, collecting **distinct** physical node IDs, until **`effectiveRf = min(replicationFactor, nodeCount)`** of them have been gathered. Skipping duplicate physical nodes is essential — without it, RF=3 with many vnodes can land all replicas on the same machine. Using `effectiveRf` (not the raw `replicationFactor`) is essential — without it, the walk loops forever when `rf > nodeCount`.
- **Storage:** `data: Map<nodeId, Map<key, value>>`. The same `(key, value)` lives under every replica nodeId. `get(key)` reads from the first replica.

### Operations and emitted events

| Operation               | Effect                                                                                       | Events emitted                                            |
| ----------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `addNode(id)`           | Insert vnode tokens; for every existing key, recompute replicas; move data for changed owners | `NodeAdded`, then one `KeyMigrated` per affected key      |
| `removeNode(id)`        | Remove tokens; reassign every key the node held to its new successors                        | `NodeRemoved`, plus one `KeyMigrated` per displaced key   |
| `put(key, value)`       | Hash, find replicas, write to all RF nodes                                                   | `KeyWritten` carrying the hash trace and replica list     |
| `get(key)`              | Hash, find replicas, return from first                                                       | `KeyRead` carrying the same trace                         |
| `setReplicationFactor`  | Re-replicate all existing keys to match new RF                                               | Bulk `KeyMigrated`                                        |
| `setVnodesPerNode`      | Regenerate tokens for all nodes; full key rebalance                                          | Bulk `KeyMigrated`                                        |

### UI-surfaced constraints

- `replicationFactor` slider range: 1–12, step 1. The user's chosen value is stored verbatim. The *effective* RF used during lookup is `min(replicationFactor, nodeCount)`. When `replicationFactor > nodeCount`, the slider's track shows a muted "capped at nodeCount" hint, and the slider thumb still sits at the chosen value — so when the user later adds nodes back, replication automatically expands to the stored RF without them needing to re-slide.
- `vnodesPerNode` slider range: 1–64, step 1.
- Max physical nodes: 12. The "+ Add node" button disables at the cap.
- "− Remove node" is disabled when `nodeCount === 1`.

## Animations & UI behaviors

### Stable visual identity

Each physical node is assigned a color from a fixed 12-color qualitative palette when it is created, and keeps that color until it is removed. All of its vnodes inherit that color. Every animation reads from this — color is the only thing that lets the user track a node visually through a rebalance.

### PUT — the headline animation

Plays in sequence after the user clicks PUT:

1. **Calc panel — stepwise reveal.** Four frames, `~400ms` each, easeOut:
   - Frame 1: key string → UTF-8 byte sequence, character by character.
   - Frame 2: bytes fold into FNV-1a digest; final 32-bit hex value materializes.
   - Frame 3: digest mapped to a ring position with `% 2^32`; angle in degrees is displayed.
   - Frame 4: replica-walk listing — `"Walking clockwise: vnode#7 (Node-3) → vnode#12 (Node-1) → vnode#3 (Node-7)"`.
2. **Ring — synchronized with frames 3–4.** A glowing probe dot appears at the computed ring position. As frame 4 plays, the probe walks clockwise, briefly pulsing each vnode it passes; the RF chosen vnodes lift slightly and stay lit.
3. **Drop.** The key (a small colored dot) drops simultaneously from the ring position onto each chosen node's inspector card.
4. **Settle.** Inspector card key counts increment via Framer Motion `layout`; the new key row fades into the card's key list.

### GET

Same first three steps as PUT, but instead of dropping the key, the first replica "pings" and the value flies back into the calc panel result row.

### Add node

- New node card slides into the inspector strip in its assigned color.
- Its `vnodesPerNode` tokens fan onto the ring, staggered 50 ms each.
- For every key whose ownership changed, a colored dot flies along the ring from the old owner's vnode region to the new owner's vnode region. Multiple migrations animate in parallel.
- Inspector counts update via `layout` — numbers tween, no popping.

### Remove node

- Node card pulses red.
- All its vnodes fade out.
- Displaced keys fly along the ring to their new successor replicas.
- Node card unmounts via Framer Motion exit.

### Slider changes (RF, vnodes/node)

Bulk rebalance, same migration animation. Capped at 24 simultaneous motion paths to stay legible; further migrations queue and animate in waves.

### Pacing controls

- **Speed slider:** `0.25× / 0.5× / 1× / 2× / 4×`, multiplies every animation duration.
- **Step mode toggle:** when on, calc-panel frames advance only when the user clicks "Next step." Off by default — frames auto-advance.

### Hover affordances

- Hover a node card → its vnodes pulse on the ring.
- Hover a key row → a thin arc lights from the key's ring position to each of its replica vnodes.

### Accessibility scope

Visualization is inherently visual; full WCAG conformance is not a goal. Color is paired with text labels where it carries information (each `NodeCard` shows the node's short ID, and the matching short ID appears near its primary vnode marker on the ring), so users who confuse two palette colors can still disambiguate.

## Error handling

Three user-facing failure surfaces. No blanket try/catch; the core is pure and either does the right thing or has a bug we fix.

| Failure                                          | Handling                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| User tries to PUT/GET with an empty key          | Inline form validation; PUT/GET button disabled until key is non-empty            |
| User tries to remove the last remaining node     | "− Remove node" disabled when `nodeCount === 1`; tooltip explains why             |
| User triggers PUT against an empty ring          | No-op; UI hint reads "Add a node first"                                           |

## Testing

Vitest. Core is rigorously tested; UI gets only a smoke test.

- **`hash.test.ts`** — known-vector tests for FNV-1a (vs. published reference outputs); determinism property test.
- **`ring.test.ts`** — per-operation tests asserting:
  - Token array remains sorted after every mutation.
  - Replica selection skips duplicate physical nodes (the easy-to-miss bug).
  - `addNode` moves exactly the keys whose replica set changed — no more, no less.
  - `removeNode` reassigns every key the removed node owned.
  - Effective-RF clamping behaves at boundaries: `rf > nodeCount` (clamps to `nodeCount`), `rf === nodeCount` (uses all nodes), `rf === 1` (single replica). The stored `rf` is unchanged by these clamps — only `lookupReplicas` reads the clamped value.
  - `lookupReplicas` is deterministic across input permutations.
- **Event-emission tests** — for each operation, the returned event list matches the actual state delta. Since UI animations are driven by events, drift here silently breaks the demo.
- **UI smoke test** — one React Testing Library test that renders `<App />` with the seed, asserts no throw. Animation timing is not unit-tested.

## File layout

```
src/
  core/
    hash.ts
    hash.test.ts
    ring.ts
    ring.test.ts
    events.ts
    types.ts
  state/
    store.ts
  components/
    App.tsx
    RingCanvas.tsx
    ControlsPanel.tsx
    CalcPanel.tsx
    NodeInspector.tsx
    NodeCard.tsx
  lib/
    palette.ts
    animation.ts
  App.css
  main.tsx
  seed.ts
index.html
vite.config.ts
tsconfig.json
tailwind.config.ts
package.json
```

## Open questions

None at design time. All defaults and ranges (palette size, vnode range, node cap, animation durations, speed steps) are concrete and listed above.
