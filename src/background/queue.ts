export interface QueueOptions {
  minSpacingMs: number
  maxRetries: number
  baseBackoffMs?: number
}

interface Job<T> {
  run: () => Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
  attempts: number
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const isRateLimit = (e: unknown) =>
  e instanceof Error && /\b429\b|rate/i.test(e.message)

export class RateLimitedQueue {
  private q: Job<any>[] = []
  private running = false
  private lastStart = 0
  constructor(private opts: QueueOptions) {}

  add<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.q.push({ run, resolve, reject, attempts: 0 })
      void this.drain()
    })
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    while (this.q.length) {
      const job = this.q.shift()!
      const wait = this.opts.minSpacingMs - (Date.now() - this.lastStart)
      if (wait > 0) await delay(wait)
      this.lastStart = Date.now()
      try {
        job.resolve(await job.run())
      } catch (e) {
        if (isRateLimit(e) && job.attempts < this.opts.maxRetries) {
          job.attempts++
          const backoff = (this.opts.baseBackoffMs ?? 1000) * 2 ** (job.attempts - 1)
          await delay(backoff)
          this.q.unshift(job)
        } else {
          job.reject(e)
        }
      }
    }
    this.running = false
  }
}
