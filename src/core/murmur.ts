const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;

/**
 * Murmur3 x86 32-bit hash. Non-cryptographic, deterministic, with much better
 * avalanche than FNV-1a — used for vnode token positions so consecutive inputs
 * like "N1#0", "N1#1", ... spread evenly around the ring. Keys themselves
 * still use FNV-1a (see hash.ts).
 *
 * Reference: https://github.com/aappleby/smhasher
 */
export function murmur3_32(input: string, seed = 0): number {
  const bytes = new TextEncoder().encode(input);
  const len = bytes.length;
  const nblocks = len >>> 2;
  let h = seed >>> 0;
  let i = 0;

  for (let block = 0; block < nblocks; block++) {
    let k1 =
      bytes[i] |
      (bytes[i + 1] << 8) |
      (bytes[i + 2] << 16) |
      (bytes[i + 3] << 24);
    k1 = Math.imul(k1, C1) >>> 0;
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
    k1 = Math.imul(k1, C2) >>> 0;

    h ^= k1;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
    i += 4;
  }

  const remaining = len & 3;
  if (remaining > 0) {
    let tail = 0;
    if (remaining >= 3) tail ^= bytes[i + 2] << 16;
    if (remaining >= 2) tail ^= bytes[i + 1] << 8;
    tail ^= bytes[i];
    tail = Math.imul(tail, C1) >>> 0;
    tail = ((tail << 15) | (tail >>> 17)) >>> 0;
    tail = Math.imul(tail, C2) >>> 0;
    h ^= tail;
  }

  h ^= len;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
