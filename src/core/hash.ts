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
