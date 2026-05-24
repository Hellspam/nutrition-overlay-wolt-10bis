import { RateLimitedQueue } from './queue'
import { callGemini, type GeminiItem } from './gemini'
import { getCached, setCached } from '../core/cache'
import { MAX_RPM, BATCH_SIZE, API_KEY_STORAGE_KEY } from '../shared/constants'
import type { EstimateRequest, EstimateResponse, Nutrition } from '../shared/types'

const queue = new RateLimitedQueue({ minSpacingMs: Math.ceil(60000 / MAX_RPM), maxRetries: 3, baseBackoffMs: 2000 })

async function getApiKey(): Promise<string | null> {
  const out = await chrome.storage.local.get(API_KEY_STORAGE_KEY)
  const key = out[API_KEY_STORAGE_KEY]
  return typeof key === 'string' && key.trim() ? key.trim() : null
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
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
    for (const batch of chunk(misses, BATCH_SIZE)) {
      const map = await queue.add(() => callGemini(apiKey, batch))
      for (const it of batch) {
        const n = map.get(it.id)
        if (n) {
          results[it.id] = n
          await setCached(it.name + '\n' + it.description, n)
        }
      }
    }
    return { ok: true, results }
  } catch {
    return { ok: false, error: 'API_ERROR', results }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ESTIMATE') {
    handleEstimate(msg as EstimateRequest).then(sendResponse)
    return true // keep the channel open for the async response
  }
  return false
})
