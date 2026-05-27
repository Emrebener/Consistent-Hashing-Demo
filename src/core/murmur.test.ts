import { describe, it, expect } from "vitest";
import { murmur3_32 } from "./murmur";

describe("murmur3_32", () => {
  it("returns 0 for the empty string with seed 0", () => {
    expect(murmur3_32("", 0)).toBe(0);
  });

  it("returns the published vector for 'abc' with seed 0", () => {
    expect(murmur3_32("abc", 0)).toBe(0xb3dd93fa);
  });

  it("returns the published vector for 'abcd' with seed 0", () => {
    expect(murmur3_32("abcd", 0)).toBe(0x43ed676a);
  });

  it("returns the published vector for 'Hello, world!' with seed 0x9747b28c", () => {
    expect(murmur3_32("Hello, world!", 0x9747b28c)).toBe(0x24884cba);
  });

  it("is deterministic", () => {
    expect(murmur3_32("alice", 0)).toBe(murmur3_32("alice", 0));
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const s of ["", "a", "abc", "Node-1#0", "🚀", "the quick brown fox"]) {
      const h = murmur3_32(s, 0);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });

  it("spreads consecutive similar inputs across the output space", () => {
    // The whole reason we use murmur3 for vnode positions: hashing "N1#0",
    // "N1#1", ..., should not cluster the outputs. We assert the spread by
    // requiring that the range of 16 hashes covers a meaningful slice of 2^32.
    const positions: number[] = [];
    for (let i = 0; i < 16; i++) positions.push(murmur3_32(`N1#${i}`, 0));
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    // A 16-sample uniform draw over 2^32 has E[max-min] ≈ (15/17) * 2^32.
    // FNV-1a on the same inputs produces a range well under 2^28 because of
    // its byte-by-byte propagation. We assert at least 2^31 here — easy for
    // murmur3, impossible for FNV-1a.
    expect(max - min).toBeGreaterThan(2 ** 31);
  });
});
