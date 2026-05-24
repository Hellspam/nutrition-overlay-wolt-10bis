import { vi } from 'vitest'

const store = new Map<string, unknown>()

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys]
        const out: Record<string, unknown> = {}
        for (const k of arr) if (store.has(k)) out[k] = store.get(k)
        return out
      }),
      set: vi.fn(async (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) store.set(k, v)
      }),
    },
  },
  runtime: { sendMessage: vi.fn(), id: 'test-ext' },
})

export function __clearStore() { store.clear() }
