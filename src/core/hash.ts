// FNV-1a 32-bit hash, returned as base36. Synchronous; stable across runs.
export function hashText(input: string): string {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}
