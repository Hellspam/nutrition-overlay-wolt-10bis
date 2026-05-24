import { describe, it, expect, beforeEach } from 'vitest'
import { getCached, setCached } from '../src/core/cache'
import { __clearStore } from './setup'
import type { Nutrition } from '../src/shared/types'

const n: Nutrition = { calories: 200, protein_g: 5, carbs_g: 38, fat_g: 4 }

describe('cache', () => {
  beforeEach(() => __clearStore())

  it('returns null on miss', async () => {
    expect(await getCached('falafel pita')).toBeNull()
  })
  it('round-trips a value keyed by text', async () => {
    await setCached('falafel pita', n)
    expect(await getCached('falafel pita')).toEqual(n)
  })
  it('is insensitive to whitespace/case (same hash)', async () => {
    await setCached('Falafel Pita', n)
    expect(await getCached('  falafel pita ')).toEqual(n)
  })
  it('misses when schema version differs', async () => {
    const { hashText } = await import('../src/core/hash')
    await chrome.storage.local.set({
      ['nut:' + hashText('x')]: { v: 999, n },
    })
    expect(await getCached('x')).toBeNull()
  })
})
