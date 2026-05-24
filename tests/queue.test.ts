import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimitedQueue } from '../src/background/queue'

describe('RateLimitedQueue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs jobs and resolves their results', async () => {
    const q = new RateLimitedQueue({ minSpacingMs: 0, maxRetries: 0 })
    const p = q.add(async () => 42)
    await vi.runAllTimersAsync()
    expect(await p).toBe(42)
  })

  it('spaces job starts by minSpacingMs', async () => {
    const starts: number[] = []
    const q = new RateLimitedQueue({ minSpacingMs: 100, maxRetries: 0 })
    const job = () => { starts.push(Date.now()); return Promise.resolve(1) }
    const p1 = q.add(job)
    const p2 = q.add(job)
    await vi.runAllTimersAsync()
    await Promise.all([p1, p2])
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(100)
  })

  it('retries with backoff when a job throws a 429 error, then succeeds', async () => {
    let calls = 0
    const q = new RateLimitedQueue({ minSpacingMs: 0, maxRetries: 2, baseBackoffMs: 50 })
    const p = q.add(async () => {
      calls++
      if (calls < 2) throw new Error('Gemini HTTP 429')
      return 'ok'
    })
    await vi.runAllTimersAsync()
    expect(await p).toBe('ok')
    expect(calls).toBe(2)
  })

  it('rejects after exhausting retries', async () => {
    const q = new RateLimitedQueue({ minSpacingMs: 0, maxRetries: 1, baseBackoffMs: 10 })
    const p = q.add(async () => { throw new Error('Gemini HTTP 429') })
    const assertion = expect(p).rejects.toThrow(/429/)
    await vi.runAllTimersAsync()
    await assertion
  })
})
