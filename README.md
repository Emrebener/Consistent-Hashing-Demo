<img width="2560" height="1440" alt="cons-hash-demo" src="https://github.com/user-attachments/assets/54aca1d7-0354-401d-8942-bbd9477605c6" />

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
