import { describe, it, expect } from 'vitest'
import { hashText } from '../src/core/hash'

describe('hashText', () => {
  it('is deterministic', () => {
    expect(hashText('שווארמה הודו')).toBe(hashText('שווארמה הודו'))
  })
  it('differs for different input', () => {
    expect(hashText('a')).not.toBe(hashText('b'))
  })
  it('normalizes surrounding whitespace and case', () => {
    expect(hashText('  Falafel  ')).toBe(hashText('falafel'))
  })
  it('returns a short non-empty string', () => {
    const h = hashText('hello world')
    expect(h.length).toBeGreaterThan(0)
    expect(h.length).toBeLessThanOrEqual(16)
  })
})
