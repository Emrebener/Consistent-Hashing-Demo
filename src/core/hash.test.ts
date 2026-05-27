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
