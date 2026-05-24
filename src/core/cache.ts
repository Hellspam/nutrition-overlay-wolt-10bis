import { hashText } from './hash'
import { CACHE_PREFIX, CACHE_SCHEMA_VERSION } from '../shared/constants'
import type { Nutrition } from '../shared/types'

interface CacheRecord { v: number; n: Nutrition }

function keyFor(text: string): string {
  return CACHE_PREFIX + hashText(text)
}

export async function getCached(text: string): Promise<Nutrition | null> {
  const key = keyFor(text)
  const out = await chrome.storage.local.get(key)
  const rec = out[key] as CacheRecord | undefined
  if (!rec || rec.v !== CACHE_SCHEMA_VERSION) return null
  return rec.n
}

export async function setCached(text: string, n: Nutrition): Promise<void> {
  const rec: CacheRecord = { v: CACHE_SCHEMA_VERSION, n }
  await chrome.storage.local.set({ [keyFor(text)]: rec })
}
