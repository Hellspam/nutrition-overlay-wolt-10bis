import { RateLimitedQueue } from './queue'
import { callGemini, type GeminiItem } from './gemini'
import { getCached, setCached } from '../core/cache'
import { MAX_RPM, API_KEY_STORAGE_KEY } from '../shared/constants'
import type { EstimateRequest, EstimateResponse, Nutrition } from '../shared/types'

const queue = new RateLimitedQueue({ minSpacingMs: Math.ceil(60000 / MAX_RPM), maxRetries: 3, baseBackoffMs: 2000 })

async function getApiKey(): Promise<string | null> {
  const out = await chrome.storage.local.get(API_KEY_STORAGE_KEY)
  const key = out[API_KEY_STORAGE_KEY]
  return typeof key === 'string' && key.trim() ? key.trim() : null
}

async function handleEstimate(req: EstimateRequest): Promise<EstimateResponse> {
  const results: Record<string, Nutrition> = {}
  const misses: GeminiItem[] = []

  for (const it of req.items) {
    const cached = await getCached(it.name + '\n' + it.description)
    if (cached) results[it.id] = cached
    else misses.push(it)
  }
  if (misses.length === 0) return { ok: true, results }

  const apiKey = await getApiKey()
  if (!apiKey) return { ok: false, error: 'NO_API_KEY', results }

  try {
    // One grouped request for all uncached items (the dish + all of its options).
    const map = await queue.add(() => callGemini(apiKey, misses))
    for (const it of misses) {
      const n = map.get(it.id)
      if (n) {
        results[it.id] = n
        await setCached(it.name + '\n' + it.description, n)
      }
    }
    return { ok: true, results }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    const limited = /\b429\b|rate|quota/i.test(msg)
    return { ok: false, error: limited ? 'RATE_LIMIT' : 'API_ERROR', results }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ESTIMATE') {
    handleEstimate(msg as EstimateRequest).then(sendResponse)
    return true // keep the channel open for the async response
  }
  return false
})
