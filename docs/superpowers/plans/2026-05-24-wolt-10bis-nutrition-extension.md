# Wolt/10bis Nutrition Overlay Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Manifest V3 Chrome extension that overlays estimated calories + macros onto every menu item on `wolt.com` and `10bis.co.il`, updating totals live as add-on options are toggled.

**Architecture:** Content script (shared core + per-site DOM adapter) scrapes item name/description from the rendered DOM and injects a nutrition badge. A background service worker owns the Gemini API key, batches requests through a rate-limit queue, validates responses, and caches them in `chrome.storage.local`. Add-on totals are recomputed client-side from DOM input state — no API call per toggle.

**Tech Stack:** TypeScript, Vite + `@crxjs/vite-plugin` (MV3 bundling/HMR), Vitest + jsdom (unit/adapter tests), Google Gemini REST API (`generativelanguage.googleapis.com`).

**Spec:** `docs/superpowers/specs/2026-05-24-wolt-10bis-nutrition-extension-design.md`

---

## File Structure

```
manifest.config.ts          # defineManifest: MV3, host-restricted to wolt/10bis
vite.config.ts              # crx({ manifest })
vitest.config.ts            # jsdom env, setup file
tsconfig.json
package.json
src/
  shared/
    types.ts                # Nutrition, MenuItem, ModalOption, message types
    constants.ts            # GEMINI_MODEL, GEMINI_ENDPOINT, MAX_RPM, CACHE_SCHEMA_VERSION, BATCH_SIZE
  core/
    hash.ts                 # stable string hash for cache keys
    nutrition.ts            # sumNutrition(), zeroNutrition()
    cache.ts                # chrome.storage.local get/set keyed by hash + schemaVersion
    messaging.ts            # typed chrome.runtime.sendMessage wrapper (content side)
  background/
    queue.ts                # rate-limit-aware request queue
    gemini.ts               # buildRequest(), parseResponse() (pure); callGemini() (fetch)
    index.ts                # service worker entry: message handler wiring
  content/
    index.ts                # entry: detect site, observe, orchestrate
    render.ts               # build/inject badge, update modal total, "no key" prompt
    adapters/
      types.ts              # SiteAdapter interface
      wolt.ts
      tenbis.ts
  options/
    index.html
    options.ts              # load/save API key
tests/
  setup.ts                  # chrome.* mock
  fixtures/                 # captured real HTML snippets (created during adapter tasks)
  hash.test.ts
  nutrition.test.ts
  cache.test.ts
  queue.test.ts
  gemini.test.ts
  render.test.ts
  wolt-adapter.test.ts
  tenbis-adapter.test.ts
```

---

## Task 1: Project scaffold + minimal loadable extension

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.config.ts`, `vitest.config.ts`, `tests/setup.ts`, `src/content/index.ts`, `src/background/index.ts`

- [ ] **Step 1: Initialize npm and install dev deps**

Run:
```bash
npm init -y
npm i -D vite @crxjs/vite-plugin @types/chrome typescript vitest jsdom
```
Expected: `node_modules/` created, deps added to `package.json` `devDependencies`. (If `@crxjs/vite-plugin` install fails to resolve an MV3-capable version, retry with `@crxjs/vite-plugin@beta`.)

- [ ] **Step 2: Write `package.json` scripts**

Edit `package.json` to set `"type": "module"` and scripts:
```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vitest/globals"],
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true
  },
  "include": ["src", "tests", "manifest.config.ts", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Write `manifest.config.ts`**

```ts
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Nutrition Overlay (Wolt & 10bis)',
  version: '0.1.0',
  description: 'Estimated calories + macros on Wolt and 10bis menu items.',
  permissions: ['storage'],
  host_permissions: [
    'https://*.10bis.co.il/*',
    'https://*.wolt.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['https://*.10bis.co.il/*', 'https://*.wolt.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
})
```

- [ ] **Step 5: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: { target: 'es2022' },
})
```

- [ ] **Step 6: Write `vitest.config.ts` and `tests/setup.ts`**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

`tests/setup.ts` (in-memory chrome.storage mock):
```ts
import { vi } from 'vitest'

const store = new Map<string, unknown>()

;(globalThis as any).chrome = {
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
}

export function __clearStore() { store.clear() }
```

- [ ] **Step 7: Write minimal entry stubs**

`src/background/index.ts`:
```ts
console.debug('[nutrition] background service worker loaded')
```

`src/content/index.ts`:
```ts
console.debug('[nutrition] content script loaded on', location.hostname)
```

- [ ] **Step 8: Build and verify output**

Run: `npm run build`
Expected: exits 0, creates `dist/manifest.json` plus bundled `dist/service-worker-loader.js` / content assets. Verify:
```bash
test -f dist/manifest.json && echo "manifest OK"
```
Expected: `manifest OK`

- [ ] **Step 9: Run the (empty) test suite**

Run: `npm test`
Expected: Vitest runs, "No test files found" or 0 tests — exits 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold MV3 extension with vite+crxjs and vitest"
```

**Manual checkpoint (do once now):** load `dist/` unpacked in Chrome (`chrome://extensions` → Developer mode → Load unpacked → select `dist/`). Open a Wolt and a 10bis page, open DevTools console, confirm `[nutrition] content script loaded`. This proves host matching works before building features.

---

## Task 2: Nutrition types + summing logic

**Files:**
- Create: `src/shared/types.ts`, `src/core/nutrition.ts`, `tests/nutrition.test.ts`

- [ ] **Step 1: Define types in `src/shared/types.ts`**

```ts
export interface Nutrition {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MenuItem {
  id: string            // cache key derived from name+description
  name: string
  description: string
  priceText: string
  anchor: HTMLElement   // node the badge is injected into/after
}

export interface ModalOption {
  label: string
  input: HTMLInputElement // the checkbox/radio to watch
}
```

- [ ] **Step 2: Write failing test `tests/nutrition.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { sumNutrition, zeroNutrition } from '../src/core/nutrition'
import type { Nutrition } from '../src/shared/types'

const a: Nutrition = { calories: 500, protein_g: 30, carbs_g: 40, fat_g: 20 }
const b: Nutrition = { calories: 310, protein_g: 4, carbs_g: 38, fat_g: 15 }

describe('sumNutrition', () => {
  it('returns zeros for empty input', () => {
    expect(sumNutrition([])).toEqual(zeroNutrition())
  })
  it('adds a base and one option', () => {
    expect(sumNutrition([a, b])).toEqual({
      calories: 810, protein_g: 34, carbs_g: 78, fat_g: 35,
    })
  })
  it('rounds fractional sums to whole numbers', () => {
    expect(sumNutrition([{ calories: 1.4, protein_g: 0.5, carbs_g: 0.5, fat_g: 0.4 },
                         { calories: 1.4, protein_g: 0.6, carbs_g: 0.6, fat_g: 0.4 }]))
      .toEqual({ calories: 3, protein_g: 1, carbs_g: 1, fat_g: 1 })
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/nutrition.test.ts`
Expected: FAIL — cannot import from `../src/core/nutrition`.

- [ ] **Step 4: Implement `src/core/nutrition.ts`**

```ts
import type { Nutrition } from '../shared/types'

export function zeroNutrition(): Nutrition {
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
}

export function sumNutrition(parts: Nutrition[]): Nutrition {
  const total = parts.reduce((acc, n) => ({
    calories: acc.calories + n.calories,
    protein_g: acc.protein_g + n.protein_g,
    carbs_g: acc.carbs_g + n.carbs_g,
    fat_g: acc.fat_g + n.fat_g,
  }), zeroNutrition())
  return {
    calories: Math.round(total.calories),
    protein_g: Math.round(total.protein_g),
    carbs_g: Math.round(total.carbs_g),
    fat_g: Math.round(total.fat_g),
  }
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/nutrition.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: nutrition types and summing logic"
```

---

## Task 3: Stable hash for cache keys

**Files:**
- Create: `src/core/hash.ts`, `tests/hash.test.ts`

- [ ] **Step 1: Write failing test `tests/hash.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/hash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/hash.ts`** (FNV-1a, synchronous, no crypto needed)

```ts
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
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/hash.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: stable FNV-1a hash for cache keys"
```

---

## Task 4: Cache over chrome.storage.local

**Files:**
- Create: `src/shared/constants.ts`, `src/core/cache.ts`, `tests/cache.test.ts`

- [ ] **Step 1: Write `src/shared/constants.ts`**

```ts
// Confirm GEMINI_MODEL is a current, free-tier model at wire-up time:
// https://ai.google.dev/gemini-api/docs/models  and  /docs/rate-limits
export const GEMINI_MODEL = 'gemini-2.5-flash'
export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
export const MAX_RPM = 10            // requests per minute (free-tier safe default)
export const BATCH_SIZE = 12         // items per Gemini request
export const CACHE_SCHEMA_VERSION = 1 // bump to invalidate all cached estimates
export const CACHE_PREFIX = 'nut:'    // chrome.storage.local key prefix
export const API_KEY_STORAGE_KEY = 'geminiApiKey'
```

- [ ] **Step 2: Write failing test `tests/cache.test.ts`**

```ts
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
    // store a record with an old version directly
    const { hashText } = await import('../src/core/hash')
    await chrome.storage.local.set({
      ['nut:' + hashText('x')]: { v: 999, n },
    })
    expect(await getCached('x')).toBeNull()
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/core/cache.ts`**

```ts
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
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/cache.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: chrome.storage.local cache with schema versioning"
```

---

## Task 5: Gemini request building + response parsing

**Files:**
- Create: `src/background/gemini.ts`, `tests/gemini.test.ts`

We unit-test the pure parts (`buildRequestBody`, `parseResponse`). The network call (`callGemini`) is a thin wrapper tested via a mocked `fetch`.

- [ ] **Step 1: Write failing test `tests/gemini.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildRequestBody, parseResponse, callGemini } from '../src/background/gemini'

const items = [
  { id: 'a', name: 'פלאפל בפיתה', description: 'עם חומוס וסלט' },
  { id: 'b', name: 'תוספת בטטה', description: '' },
]

describe('buildRequestBody', () => {
  it('asks for JSON and includes every item id in the prompt', () => {
    const body = buildRequestBody(items)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    const text = body.contents[0].parts[0].text
    expect(text).toContain('a')
    expect(text).toContain('b')
    expect(text).toContain('פלאפל בפיתה')
  })
})

describe('parseResponse', () => {
  function geminiEnvelope(payload: unknown) {
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }
  }
  it('maps a well-formed array to a Map by id', () => {
    const res = parseResponse(geminiEnvelope([
      { id: 'a', calories: 450, protein_g: 12, carbs_g: 55, fat_g: 18 },
      { id: 'b', calories: 180, protein_g: 2, carbs_g: 30, fat_g: 6 },
    ]), ['a', 'b'])
    expect(res.get('a')).toEqual({ calories: 450, protein_g: 12, carbs_g: 55, fat_g: 18 })
    expect(res.get('b')!.calories).toBe(180)
  })
  it('skips entries with missing/invalid fields', () => {
    const res = parseResponse(geminiEnvelope([
      { id: 'a', calories: 450, protein_g: 12, carbs_g: 55, fat_g: 18 },
      { id: 'b', calories: 'lots' },
    ]), ['a', 'b'])
    expect(res.has('a')).toBe(true)
    expect(res.has('b')).toBe(false)
  })
  it('clamps negatives and coerces numeric strings', () => {
    const res = parseResponse(geminiEnvelope([
      { id: 'a', calories: -5, protein_g: '12', carbs_g: 55, fat_g: 18 },
    ]), ['a'])
    expect(res.get('a')).toEqual({ calories: 0, protein_g: 12, carbs_g: 55, fat_g: 18 })
  })
  it('throws on a non-JSON / empty candidate', () => {
    expect(() => parseResponse({ candidates: [] }, ['a'])).toThrow()
  })
})

describe('callGemini', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('throws on HTTP 429 so the queue can back off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate', { status: 429 })))
    await expect(callGemini('KEY', items)).rejects.toThrow(/429/)
  })
  it('returns parsed map on 200', async () => {
    const ok = { candidates: [{ content: { parts: [{ text: JSON.stringify([
      { id: 'a', calories: 450, protein_g: 12, carbs_g: 55, fat_g: 18 },
      { id: 'b', calories: 180, protein_g: 2, carbs_g: 30, fat_g: 6 },
    ]) }] } }] }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 })))
    const res = await callGemini('KEY', items)
    expect(res.get('a')!.calories).toBe(450)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/gemini.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/background/gemini.ts`**

```ts
import { GEMINI_ENDPOINT } from '../shared/constants'
import type { Nutrition } from '../shared/types'

export interface GeminiItem { id: string; name: string; description: string }

interface RequestBody {
  contents: { parts: { text: string }[] }[]
  generationConfig: { responseMimeType: string; temperature: number }
}

export function buildRequestBody(items: GeminiItem[]): RequestBody {
  const list = items
    .map((it) => `- id="${it.id}": ${it.name}${it.description ? ' — ' + it.description : ''}`)
    .join('\n')
  const prompt =
    `You are a nutrition estimator. For each food item below (text may be Hebrew), ` +
    `estimate the nutrition for ONE standard serving as typically sold. ` +
    `Return ONLY a JSON array, one object per item, in this exact shape and order is not required ` +
    `(match by id):\n` +
    `[{"id": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}]\n` +
    `All numbers are per single serving, non-negative, grams for macros. No prose, no markdown.\n\n` +
    `Items:\n${list}`
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  }
}

function coerceNum(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.max(0, n)
}

function toNutrition(raw: any): Nutrition | null {
  const calories = coerceNum(raw?.calories)
  const protein_g = coerceNum(raw?.protein_g)
  const carbs_g = coerceNum(raw?.carbs_g)
  const fat_g = coerceNum(raw?.fat_g)
  if (calories === null || protein_g === null || carbs_g === null || fat_g === null) return null
  return { calories, protein_g, carbs_g, fat_g }
}

export function parseResponse(envelope: any, _ids: string[]): Map<string, Nutrition> {
  const text: string | undefined = envelope?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini: empty candidate')
  let arr: any
  try { arr = JSON.parse(text) } catch { throw new Error('Gemini: response was not JSON') }
  if (!Array.isArray(arr)) throw new Error('Gemini: expected a JSON array')
  const out = new Map<string, Nutrition>()
  for (const entry of arr) {
    const id = entry?.id
    const n = toNutrition(entry)
    if (typeof id === 'string' && n) out.set(id, n)
  }
  return out
}

export async function callGemini(apiKey: string, items: GeminiItem[]): Promise<Map<string, Nutrition>> {
  const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildRequestBody(items)),
  })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  return parseResponse(await res.json(), items.map((i) => i.id))
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/gemini.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: gemini request builder, response validator, and client"
```

---

## Task 6: Rate-limit-aware request queue

**Files:**
- Create: `src/background/queue.ts`, `tests/queue.test.ts`

The queue serializes async jobs, enforces a minimum spacing of `60000 / MAX_RPM` ms between job starts, and retries a job with exponential backoff when it throws a rate-limit error.

- [ ] **Step 1: Write failing test `tests/queue.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/queue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/background/queue.ts`**

```ts
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
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/queue.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: rate-limited retrying request queue"
```

---

## Task 7: Message contract + background wiring

**Files:**
- Modify: `src/shared/types.ts` (add message types)
- Create: `src/core/messaging.ts`
- Rewrite: `src/background/index.ts`
- Create: `tests/messaging.test.ts`

- [ ] **Step 1: Add message types to `src/shared/types.ts`**

Append:
```ts
export interface EstimateRequest {
  type: 'ESTIMATE'
  items: { id: string; name: string; description: string }[]
}
export interface EstimateResponse {
  ok: boolean
  results?: Record<string, Nutrition> // id -> nutrition (only successful ones)
  error?: 'NO_API_KEY' | 'API_ERROR'
}
```

- [ ] **Step 2: Write failing test `tests/messaging.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { requestEstimates } from '../src/core/messaging'

describe('requestEstimates', () => {
  it('sends an ESTIMATE message and returns the response', async () => {
    const resp = { ok: true, results: { a: { calories: 1, protein_g: 1, carbs_g: 1, fat_g: 1 } } }
    ;(chrome.runtime.sendMessage as any) = vi.fn(async () => resp)
    const items = [{ id: 'a', name: 'x', description: '' }]
    expect(await requestEstimates(items)).toEqual(resp)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'ESTIMATE', items })
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/messaging.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/core/messaging.ts`**

```ts
import type { EstimateRequest, EstimateResponse } from '../shared/types'

export async function requestEstimates(
  items: EstimateRequest['items'],
): Promise<EstimateResponse> {
  return chrome.runtime.sendMessage({ type: 'ESTIMATE', items } as EstimateRequest)
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/messaging.test.ts`
Expected: PASS.

- [ ] **Step 6: Rewrite `src/background/index.ts`** (wires cache + queue + gemini; dedupes by id and caches results)

```ts
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

  // 1. cache pass — key by name+description (same text the content script hashed)
  for (const it of req.items) {
    const cached = await getCached(it.name + '\n' + it.description)
    if (cached) results[it.id] = cached
    else misses.push(it)
  }
  if (misses.length === 0) return { ok: true, results }

  const apiKey = await getApiKey()
  if (!apiKey) return { ok: false, error: 'NO_API_KEY', results }

  // 2. batch the misses through the rate-limited queue
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
```

- [ ] **Step 7: Build to confirm the worker compiles**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: background message handler wiring cache, queue, and gemini"
```

---

## Task 8: SiteAdapter interface + nutrition rendering

**Files:**
- Create: `src/content/adapters/types.ts`, `src/content/render.ts`, `tests/render.test.ts`

- [ ] **Step 1: Write `src/content/adapters/types.ts`**

```ts
import type { MenuItem, ModalOption } from '../../shared/types'

export interface SiteAdapter {
  /** True if this adapter handles the current hostname. */
  matches(host: string): boolean
  /** Root node to attach the MutationObserver to. */
  observeRoot(): HTMLElement
  /** Extract all currently-rendered menu items. */
  findItems(root: ParentNode): MenuItem[]
  /** Given an open modal root, the selectable add-on option rows. */
  findModalOptions(modalRoot: HTMLElement): ModalOption[]
  /** Within an open modal, the element to render the running total into/near. */
  getModalTotalAnchor(modalRoot: HTMLElement): HTMLElement | null
  /** Detect an open item modal within a mutation, or null. */
  findOpenModal(root: ParentNode): HTMLElement | null
}
```

- [ ] **Step 2: Write failing test `tests/render.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderBadge, renderError, BADGE_CLASS } from '../src/content/render'
import type { Nutrition } from '../src/shared/types'

const n: Nutrition = { calories: 540, protein_g: 28, carbs_g: 60, fat_g: 22 }

describe('renderBadge', () => {
  let anchor: HTMLElement
  beforeEach(() => { document.body.innerHTML = '<div id="card"></div>'; anchor = document.getElementById('card')! })

  it('injects a single badge containing calories and macros', () => {
    renderBadge(anchor, n)
    const badge = anchor.querySelector('.' + BADGE_CLASS)!
    expect(badge).toBeTruthy()
    expect(badge.textContent).toContain('540')
    expect(badge.textContent).toMatch(/28/)  // protein
    expect(badge.getAttribute('dir')).toBe('rtl')
  })

  it('is idempotent — re-rendering replaces, does not duplicate', () => {
    renderBadge(anchor, n)
    renderBadge(anchor, { ...n, calories: 600 })
    expect(anchor.querySelectorAll('.' + BADGE_CLASS).length).toBe(1)
    expect(anchor.querySelector('.' + BADGE_CLASS)!.textContent).toContain('600')
  })

  it('renderError shows an unobtrusive marker', () => {
    renderError(anchor)
    expect(anchor.querySelector('.' + BADGE_CLASS)!.textContent).toMatch(/—|\?/)
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/render.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/content/render.ts`**

```ts
import type { Nutrition } from '../shared/types'

export const BADGE_CLASS = 'nutrition-overlay-badge'

function ensureBadge(anchor: HTMLElement): HTMLElement {
  let badge = anchor.querySelector<HTMLElement>('.' + BADGE_CLASS)
  if (!badge) {
    badge = document.createElement('div')
    badge.className = BADGE_CLASS
    badge.setAttribute('dir', 'rtl')
    // Inline styles keep us independent of the host stylesheet.
    Object.assign(badge.style, {
      display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
      marginTop: '6px', fontSize: '12px', lineHeight: '1.4', opacity: '0.95',
    } as Partial<CSSStyleDeclaration>)
    anchor.appendChild(badge)
  }
  return badge
}

export function renderBadge(anchor: HTMLElement, n: Nutrition): void {
  const badge = ensureBadge(anchor)
  badge.textContent = ''
  const cal = document.createElement('strong')
  cal.textContent = `${n.calories} קל'`
  const macros = document.createElement('span')
  macros.textContent = `חלבון ${n.protein_g} · פחמ' ${n.carbs_g} · שומן ${n.fat_g}`
  macros.style.opacity = '0.8'
  const est = document.createElement('span')
  est.textContent = '~הערכה'
  est.style.opacity = '0.55'
  est.style.fontSize = '11px'
  badge.append(cal, macros, est)
}

export function renderError(anchor: HTMLElement): void {
  const badge = ensureBadge(anchor)
  badge.textContent = "ערכים תזונתיים — לא זמין"
  badge.style.opacity = '0.5'
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run tests/render.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: SiteAdapter interface and nutrition badge rendering"
```

---

## Task 9: Wolt adapter (against a captured fixture)

**Files:**
- Create: `tests/fixtures/wolt-card.html`, `tests/fixtures/wolt-modal.html`, `src/content/adapters/wolt.ts`, `tests/wolt-adapter.test.ts`

> The adapter's selectors can only be finalized against the **rendered** DOM. Capture real fixtures first, then write selectors until the invariant tests pass. Tests assert structural invariants (not site-specific strings) so they remain valid as Wolt's content changes.

- [ ] **Step 1: Capture fixtures from a live Wolt menu**

In Chrome on a Wolt restaurant page:
1. Right-click one menu item card → Inspect → in Elements, right-click the card's outermost element → Copy → Copy outerHTML. Save to `tests/fixtures/wolt-card.html` wrapped in `<body>…</body>`. Capture **2–3 cards** inside one container so `findItems` can be exercised on multiple.
2. Open an item that has add-on options → Inspect the modal → copy the modal root's outerHTML → save to `tests/fixtures/wolt-modal.html`.

- [ ] **Step 2: Write `tests/wolt-adapter.test.ts`** (invariant-based)

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { woltAdapter } from '../src/content/adapters/wolt'

const load = (f: string) =>
  new JSDOM(readFileSync(resolve(__dirname, 'fixtures', f), 'utf8')).window.document

describe('woltAdapter', () => {
  it('matches wolt hostnames only', () => {
    expect(woltAdapter.matches('wolt.com')).toBe(true)
    expect(woltAdapter.matches('www.10bis.co.il')).toBe(false)
  })

  it('finds menu items with non-empty names and a real anchor', () => {
    const doc = load('wolt-card.html')
    const items = woltAdapter.findItems(doc)
    expect(items.length).toBeGreaterThan(0)
    for (const it of items) {
      expect(it.name.trim().length).toBeGreaterThan(0)
      expect(typeof it.description).toBe('string')
      expect(it.anchor instanceof doc.defaultView!.HTMLElement).toBe(true)
      expect(it.id.length).toBeGreaterThan(0)
    }
  })

  it('finds modal options each with a label and a checkbox/radio input', () => {
    const doc = load('wolt-modal.html')
    const modal = woltAdapter.findOpenModal(doc) ?? doc.body
    const opts = woltAdapter.findModalOptions(modal)
    expect(opts.length).toBeGreaterThan(0)
    for (const o of opts) {
      expect(o.label.trim().length).toBeGreaterThan(0)
      expect(['checkbox', 'radio']).toContain(o.input.type)
    }
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/wolt-adapter.test.ts`
Expected: FAIL — module not found (and/or fixture parsing).

- [ ] **Step 4: Implement `src/content/adapters/wolt.ts`**

Write selectors based on the captured fixture. Starting structure (adjust selector strings to the real attributes you observe — prefer stable `data-test-id` / roles over generated classes):

```ts
import { hashText } from '../../core/hash'
import type { MenuItem, ModalOption } from '../../shared/types'
import type { SiteAdapter } from './types'

// Wolt cards expose data-test-id attributes like "menu-item" / "horizontal-item-card".
// Confirm the exact values against tests/fixtures/wolt-card.html and update below.
const ITEM_SELECTOR = '[data-test-id^="menu-item"], [data-test-id*="ItemCard"]'
const NAME_SELECTOR = '[data-test-id="venueMenuItem-name"], h3, [class*="name" i]'
const DESC_SELECTOR = '[data-test-id="venueMenuItem-description"], [class*="description" i]'
const PRICE_SELECTOR = '[data-test-id*="price" i], [class*="price" i]'

function text(el: Element | null): string {
  return (el?.textContent ?? '').trim()
}

export const woltAdapter: SiteAdapter = {
  matches: (host) => /(^|\.)wolt\.com$/.test(host),
  observeRoot: () => document.body,

  findItems(root) {
    const cards = Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
    const items: MenuItem[] = []
    for (const card of cards) {
      const name = text(card.querySelector(NAME_SELECTOR))
      if (!name) continue
      const description = text(card.querySelector(DESC_SELECTOR))
      const priceText = text(card.querySelector(PRICE_SELECTOR))
      items.push({ id: hashText(name + '\n' + description), name, description, priceText, anchor: card })
    }
    return items
  },

  findOpenModal(root) {
    // Wolt renders the item dialog with role="dialog".
    return root.querySelector<HTMLElement>('[role="dialog"]')
  },

  findModalOptions(modalRoot) {
    const inputs = Array.from(modalRoot.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'))
    const opts: ModalOption[] = []
    for (const input of inputs) {
      const row = input.closest('label, li, [role="option"], div')
      const label = text(row).replace(/\s+/g, ' ').trim()
      if (label) opts.push({ label, input })
    }
    return opts
  },

  getModalTotalAnchor(modalRoot) {
    // Place the running total near the footer/submit button.
    return modalRoot.querySelector<HTMLElement>('[data-test-id*="submit" i], footer, button')
  },
}
```

- [ ] **Step 5: Iterate selectors until the test passes**

Run: `npx vitest run tests/wolt-adapter.test.ts`
Adjust `ITEM_SELECTOR`/`NAME_SELECTOR`/etc. against the fixture until all 3 tests pass.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: wolt site adapter with fixture-based tests"
```

---

## Task 10: 10bis adapter (against a captured fixture)

**Files:**
- Create: `tests/fixtures/tenbis-card.html`, `tests/fixtures/tenbis-modal.html`, `src/content/adapters/tenbis.ts`, `tests/tenbis-adapter.test.ts`

- [ ] **Step 1: Capture fixtures from a live 10bis menu**

Same procedure as Task 9, Step 1, but on a `10bis.co.il` restaurant menu (matches the screenshots: item cards with name/description/price; an item modal with `בחרו עד N תוספות` option groups and `+₪` priced add-ons). Save 2–3 cards to `tests/fixtures/tenbis-card.html` and one modal to `tests/fixtures/tenbis-modal.html`.

- [ ] **Step 2: Write `tests/tenbis-adapter.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { tenbisAdapter } from '../src/content/adapters/tenbis'

const load = (f: string) =>
  new JSDOM(readFileSync(resolve(__dirname, 'fixtures', f), 'utf8')).window.document

describe('tenbisAdapter', () => {
  it('matches 10bis hostnames only', () => {
    expect(tenbisAdapter.matches('www.10bis.co.il')).toBe(true)
    expect(tenbisAdapter.matches('wolt.com')).toBe(false)
  })

  it('finds menu items with non-empty names and a real anchor', () => {
    const doc = load('tenbis-card.html')
    const items = tenbisAdapter.findItems(doc)
    expect(items.length).toBeGreaterThan(0)
    for (const it of items) {
      expect(it.name.trim().length).toBeGreaterThan(0)
      expect(typeof it.description).toBe('string')
      expect(it.anchor instanceof doc.defaultView!.HTMLElement).toBe(true)
    }
  })

  it('finds modal options each with a label and a checkbox/radio input', () => {
    const doc = load('tenbis-modal.html')
    const modal = tenbisAdapter.findOpenModal(doc) ?? doc.body
    const opts = tenbisAdapter.findModalOptions(modal)
    expect(opts.length).toBeGreaterThan(0)
    for (const o of opts) {
      expect(o.label.trim().length).toBeGreaterThan(0)
      expect(['checkbox', 'radio']).toContain(o.input.type)
    }
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run tests/tenbis-adapter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/content/adapters/tenbis.ts`**

Mirror the Wolt adapter's shape, with selectors matched to the 10bis fixture (10bis is a React app with generated classes — prefer structural/text/`aria` anchors; the card root is the element wrapping name + description + price + the "＋" add button):

```ts
import { hashText } from '../../core/hash'
import type { MenuItem, ModalOption } from '../../shared/types'
import type { SiteAdapter } from './types'

// Adjust these to tests/fixtures/tenbis-card.html. 10bis class names are generated,
// so anchor on structure: a card contains a heading-like name + a description line + a price.
const ITEM_SELECTOR = '[class*="dish" i], [class*="MenuItem" i], li'
const NAME_SELECTOR = '[class*="name" i], h3, h4'
const DESC_SELECTOR = '[class*="description" i], p'
const PRICE_SELECTOR = '[class*="price" i]'

function text(el: Element | null): string {
  return (el?.textContent ?? '').trim()
}

export const tenbisAdapter: SiteAdapter = {
  matches: (host) => /(^|\.)10bis\.co\.il$/.test(host),
  observeRoot: () => document.body,

  findItems(root) {
    const cards = Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
    const items: MenuItem[] = []
    for (const card of cards) {
      const name = text(card.querySelector(NAME_SELECTOR))
      if (!name) continue
      const description = text(card.querySelector(DESC_SELECTOR))
      const priceText = text(card.querySelector(PRICE_SELECTOR))
      items.push({ id: hashText(name + '\n' + description), name, description, priceText, anchor: card })
    }
    return items
  },

  findOpenModal(root) {
    return root.querySelector<HTMLElement>('[role="dialog"], [class*="modal" i], [class*="popup" i]')
  },

  findModalOptions(modalRoot) {
    const inputs = Array.from(modalRoot.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'))
    const opts: ModalOption[] = []
    for (const input of inputs) {
      const row = input.closest('label, li, div')
      const label = text(row).replace(/\s+/g, ' ').trim()
      if (label) opts.push({ label, input })
    }
    return opts
  },

  getModalTotalAnchor(modalRoot) {
    return modalRoot.querySelector<HTMLElement>('button[class*="add" i], footer, button')
  },
}
```

- [ ] **Step 5: Iterate selectors until the test passes**

Run: `npx vitest run tests/tenbis-adapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 10bis site adapter with fixture-based tests"
```

---

## Task 11: Content orchestrator (discovery, render, observe, modal totals)

**Files:**
- Create: `src/content/orchestrator.ts` (testable logic), `tests/orchestrator.test.ts`
- Rewrite: `src/content/index.ts` (thin entry: picks adapter, starts orchestrator)

We split the testable orchestration (given an adapter + a "fetch estimates" function, discover/render items and wire a modal) from the entry that supplies the real adapter and messaging.

- [ ] **Step 1: Write failing test `tests/orchestrator.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processItems, wireModal } from '../src/content/orchestrator'
import { BADGE_CLASS } from '../src/content/render'
import type { SiteAdapter } from '../src/content/adapters/types'
import type { MenuItem, ModalOption, Nutrition } from '../src/shared/types'

const N = (c: number): Nutrition => ({ calories: c, protein_g: 1, carbs_g: 1, fat_g: 1 })

function fakeAdapter(items: MenuItem[], options: ModalOption[]): SiteAdapter {
  return {
    matches: () => true,
    observeRoot: () => document.body,
    findItems: () => items,
    findOpenModal: () => document.querySelector('[role="dialog"]'),
    findModalOptions: () => options,
    getModalTotalAnchor: () => document.querySelector('#total'),
  }
}

describe('processItems', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('renders a badge per item using fetched estimates', async () => {
    document.body.innerHTML = '<div id="c1"></div><div id="c2"></div>'
    const items: MenuItem[] = [
      { id: 'a', name: 'A', description: '', priceText: '', anchor: document.getElementById('c1')! },
      { id: 'b', name: 'B', description: '', priceText: '', anchor: document.getElementById('c2')! },
    ]
    const fetchEstimates = vi.fn(async () => ({ ok: true, results: { a: N(500), b: N(300) } }))
    await processItems(fakeAdapter(items, []), document, fetchEstimates)
    expect(document.querySelectorAll('.' + BADGE_CLASS).length).toBe(2)
    expect(document.getElementById('c1')!.textContent).toContain('500')
  })

  it('skips items already rendered (no duplicate fetches)', async () => {
    document.body.innerHTML = '<div id="c1"></div>'
    const items: MenuItem[] = [{ id: 'a', name: 'A', description: '', priceText: '', anchor: document.getElementById('c1')! }]
    const fetchEstimates = vi.fn(async () => ({ ok: true, results: { a: N(500) } }))
    const adapter = fakeAdapter(items, [])
    await processItems(adapter, document, fetchEstimates)
    await processItems(adapter, document, fetchEstimates)
    expect(fetchEstimates).toHaveBeenCalledTimes(1)
  })
})

describe('wireModal', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('updates the total as options are toggled (base + selected)', async () => {
    document.body.innerHTML =
      '<div role="dialog"><label><input type="checkbox">fries</label>' +
      '<label><input type="checkbox">rice</label><div id="total"></div></div>'
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input')]
    const options: ModalOption[] = [
      { label: 'fries', input: inputs[0] },
      { label: 'rice', input: inputs[1] },
    ]
    const adapter = fakeAdapter([], options)
    const fetchEstimates = vi.fn(async (its: { id: string }[]) => ({
      ok: true,
      results: Object.fromEntries(its.map((i) => [i.id, i.id === 'BASE' ? N(600) : i.id.includes('fries') ? N(310) : N(200)])),
    }))
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!
    await wireModal(adapter, modal, { id: 'BASE', name: 'Shawarma', description: '' }, fetchEstimates)

    const totalText = () => document.querySelector('.' + BADGE_CLASS + '-total')!.textContent ?? ''
    expect(totalText()).toContain('600')          // base only
    inputs[0].checked = true; inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    expect(totalText()).toContain('910')          // + fries
    inputs[1].checked = true; inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
    expect(totalText()).toContain('1110')         // + rice
    inputs[0].checked = false; inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    expect(totalText()).toContain('800')          // base + rice
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/orchestrator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/content/orchestrator.ts`**

```ts
import type { SiteAdapter } from './adapters/types'
import type { EstimateResponse, MenuItem, Nutrition } from '../shared/types'
import { renderBadge, renderError, BADGE_CLASS } from './render'
import { sumNutrition } from '../core/nutrition'

type FetchEstimates = (
  items: { id: string; name: string; description: string }[],
) => Promise<EstimateResponse>

const RENDERED = new WeakSet<HTMLElement>()

export async function processItems(
  adapter: SiteAdapter,
  root: ParentNode,
  fetchEstimates: FetchEstimates,
): Promise<void> {
  const all = adapter.findItems(root)
  const fresh = all.filter((it) => !RENDERED.has(it.anchor))
  if (fresh.length === 0) return
  fresh.forEach((it) => RENDERED.add(it.anchor))

  const resp = await fetchEstimates(fresh.map(({ id, name, description }) => ({ id, name, description })))
  for (const it of fresh) {
    const n = resp.results?.[it.id]
    if (n) renderBadge(it.anchor, n)
    else renderError(it.anchor)
  }
}

interface BaseRef { id: string; name: string; description: string }

export async function wireModal(
  adapter: SiteAdapter,
  modal: HTMLElement,
  base: BaseRef,
  fetchEstimates: FetchEstimates,
): Promise<void> {
  if ((modal as any).__nutritionWired) return
  ;(modal as any).__nutritionWired = true

  const options = adapter.findModalOptions(modal)
  const reqItems = [
    { id: base.id, name: base.name, description: base.description },
    ...options.map((o, i) => ({ id: `opt:${i}:${o.label}`, name: o.label, description: '' })),
  ]
  const resp = await fetchEstimates(reqItems)
  const baseN = resp.results?.[base.id] ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  const optN: (Nutrition | undefined)[] = options.map((_, i) => resp.results?.[`opt:${i}:${options[i].label}`])

  const anchor = adapter.getModalTotalAnchor(modal) ?? modal
  const recompute = () => {
    const selected = options
      .map((o, i) => (o.input.checked ? optN[i] : undefined))
      .filter((n): n is Nutrition => !!n)
    renderTotal(anchor, sumNutrition([baseN, ...selected]))
  }
  options.forEach((o) => o.input.addEventListener('change', recompute))
  recompute()
}

function renderTotal(anchor: HTMLElement, n: Nutrition): void {
  // The total is inserted as a sibling before the anchor, so search the parent scope
  // (not inside the anchor) to find and reuse it — otherwise each recompute duplicates it.
  const scope = anchor.parentElement ?? anchor
  let el = scope.querySelector<HTMLElement>('.' + BADGE_CLASS + '-total')
  if (!el) {
    el = document.createElement('div')
    el.className = BADGE_CLASS + '-total'
    el.setAttribute('dir', 'rtl')
    Object.assign(el.style, { fontSize: '13px', fontWeight: '600', margin: '6px 0' } as Partial<CSSStyleDeclaration>)
    if (anchor.parentElement) anchor.parentElement.insertBefore(el, anchor)
    else anchor.appendChild(el)
  }
  el.textContent = `סה"כ ~${n.calories} קל' · חלבון ${n.protein_g} · פחמ' ${n.carbs_g} · שומן ${n.fat_g}`
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run tests/orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `src/content/index.ts`** (thin entry)

```ts
import { woltAdapter } from './adapters/wolt'
import { tenbisAdapter } from './adapters/tenbis'
import type { SiteAdapter } from './adapters/types'
import { processItems, wireModal } from './orchestrator'
import { requestEstimates } from '../core/messaging'
import { renderNoKeyPrompt } from './render'

const adapters: SiteAdapter[] = [woltAdapter, tenbisAdapter]
const adapter = adapters.find((a) => a.matches(location.hostname))
if (adapter) start(adapter)

function start(adapter: SiteAdapter) {
  const fetchEstimates = async (items: { id: string; name: string; description: string }[]) => {
    const resp = await requestEstimates(items)
    if (!resp.ok && resp.error === 'NO_API_KEY') renderNoKeyPrompt()
    return resp
  }

  const run = () => { void processItems(adapter, document, fetchEstimates) }
  run()

  // Debounced observer for lazy-loaded cards, SPA route changes, and modal opening.
  let t: number | undefined
  const obs = new MutationObserver(() => {
    window.clearTimeout(t)
    t = window.setTimeout(() => {
      run()
      const modal = adapter.findOpenModal(document)
      if (modal) {
        const items = adapter.findItems(document)
        // Best-effort base: the item whose name appears in the modal heading.
        const base = items.find((it) => modal.textContent?.includes(it.name)) ?? items[0]
        if (base) void wireModal(adapter, modal, base, fetchEstimates)
      }
    }, 400)
  })
  obs.observe(adapter.observeRoot(), { childList: true, subtree: true })
}
```

- [ ] **Step 6: Add `renderNoKeyPrompt` to `src/content/render.ts`**

Append:
```ts
export function renderNoKeyPrompt(): void {
  if (document.getElementById('nutrition-overlay-nokey')) return
  const bar = document.createElement('div')
  bar.id = 'nutrition-overlay-nokey'
  bar.setAttribute('dir', 'rtl')
  bar.textContent = 'תוסף ערכים תזונתיים: הגדירו מפתח Gemini חינמי בהגדרות התוסף ←'
  Object.assign(bar.style, {
    position: 'fixed', bottom: '12px', insetInlineStart: '12px', zIndex: '2147483647',
    background: '#222', color: '#fff', padding: '8px 12px', borderRadius: '8px',
    fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
  } as Partial<CSSStyleDeclaration>)
  bar.addEventListener('click', () => chrome.runtime.openOptionsPage())
  document.body.appendChild(bar)
}
```

- [ ] **Step 7: Build and run full test suite**

Run: `npm run build && npm test`
Expected: build exits 0; all test files pass.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: content orchestrator wiring discovery, rendering, and live modal totals"
```

---

## Task 12: Options page (API key entry)

**Files:**
- Create: `src/options/index.html`, `src/options/options.ts`

- [ ] **Step 1: Write `src/options/index.html`**

```html
<!doctype html>
<html dir="rtl" lang="he">
  <head>
    <meta charset="utf-8" />
    <title>הגדרות — ערכים תזונתיים</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 520px; margin: 40px auto; padding: 0 16px; }
      label { display: block; font-weight: 600; margin-bottom: 8px; }
      input { width: 100%; padding: 10px; font-size: 14px; box-sizing: border-box; }
      button { margin-top: 12px; padding: 10px 16px; font-size: 14px; cursor: pointer; }
      .hint { color: #555; font-size: 13px; margin-top: 8px; line-height: 1.5; }
      .ok { color: #137333; font-weight: 600; }
      a { color: #1a73e8; }
    </style>
  </head>
  <body>
    <h1>ערכים תזונתיים — הגדרות</h1>
    <label for="key">מפתח Gemini API</label>
    <input id="key" type="password" placeholder="הדביקו את המפתח כאן" autocomplete="off" />
    <button id="save">שמירה</button>
    <span id="status" class="ok"></span>
    <p class="hint">
      קבלו מפתח חינמי ב־<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>.
      המפתח נשמר מקומית בדפדפן בלבד. תיאורי הפריטים נשלחים ל־Gemini לצורך הערכת הערכים התזונתיים.
    </p>
    <script type="module" src="./options.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `src/options/options.ts`**

```ts
import { API_KEY_STORAGE_KEY } from '../shared/constants'

const input = document.getElementById('key') as HTMLInputElement
const status = document.getElementById('status') as HTMLElement

chrome.storage.local.get(API_KEY_STORAGE_KEY).then((out) => {
  const v = out[API_KEY_STORAGE_KEY]
  if (typeof v === 'string') input.value = v
})

document.getElementById('save')!.addEventListener('click', async () => {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: input.value.trim() })
  status.textContent = 'נשמר ✓'
  setTimeout(() => (status.textContent = ''), 2000)
})
```

- [ ] **Step 3: Build and verify the options page is bundled**

Run: `npm run build`
Expected: exits 0; `dist/` contains the options HTML + bundled `options` JS. Verify the manifest references it:
```bash
node -e "const m=require('./dist/manifest.json'); console.log(m.options_page)"
```
Expected: prints an options HTML path.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: options page for Gemini API key entry"
```

---

## Task 13: Manual end-to-end verification + shareable package

**Files:**
- Create: `README.md`

- [ ] **Step 1: Full build + test gate**

Run: `npm run build && npm test`
Expected: build exits 0; every test passes. Record the final test count.

- [ ] **Step 2: Manual E2E on Wolt**

1. `chrome://extensions` → Load unpacked → `dist/`.
2. Open the options page, paste a real Gemini key, save.
3. Open a Wolt restaurant menu. Confirm: badges with calories+macros appear on item cards within a few seconds; the `~הערכה` marker is present.
4. Open an item with add-ons. Confirm: a total appears; toggling fries/rice changes the total immediately; unchecking reverts it.
5. Reload the page. Confirm badges appear faster (cache hit; check the Network tab shows no new `generativelanguage` calls for already-seen items).

If selectors miss real elements, return to Task 9 and refine `wolt.ts` against the live DOM, re-running its fixture test.

- [ ] **Step 3: Manual E2E on 10bis**

Repeat Step 2 items 3–5 on a `10bis.co.il` restaurant menu (matches the screenshots). Refine `tenbis.ts` (Task 10) if needed.

- [ ] **Step 4: Verify host restriction**

Open any non-Wolt/10bis site (e.g. `example.com`). Confirm no badges, no console logs from the extension, no `generativelanguage` requests.

- [ ] **Step 5: Write `README.md`**

```markdown
# Nutrition Overlay — Wolt & 10bis

Adds **estimated** calories + macros to menu items on wolt.com and 10bis.co.il,
updating totals as you pick add-ons. Estimates come from Google Gemini and are
approximate.

## Install (unpacked)
1. Download/unzip this folder.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `dist/` folder.
3. Click the extension's **Details → Extension options**, paste a free Gemini API
   key from https://aistudio.google.com/apikey, and Save.
4. Open a Wolt or 10bis menu — values appear automatically.

## Build from source
```
npm install
npm run build   # outputs dist/
npm test        # run unit + adapter tests
```

## Privacy
Item names/descriptions are sent to Google Gemini to estimate nutrition. Your API
key and cached results are stored locally in the browser. The extension runs only
on wolt.com and 10bis.co.il.
```

- [ ] **Step 6: Produce the shareable zip**

Run: `cd dist && zip -r ../nutrition-overlay.zip . && cd ..`
Expected: `nutrition-overlay.zip` created — this is the artifact to share in Slack (recipients "Load unpacked" after unzipping, then add their own key).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "docs: README and end-to-end verification checklist"
```

---

## Self-Review Notes (author)

- **Spec coverage:** Wolt+10bis only (Task 1 manifest + adapter `matches`); read name/description (Tasks 9–10); free LLM = Gemini (Task 5); calories+macros (Tasks 2, 8); auto-on-load + cache (Tasks 4, 11); live add-on totals (Task 11 `wireModal`); per-user key + options page (Task 12); error handling — no key / API error / bad output / DOM drift (Tasks 5, 7, 8, 11); testing core + adapters + render (Tasks 2–11); zip distribution (Task 13). All spec requirements mapped.
- **Open risk carried from spec:** adapter selectors require live-DOM capture (Tasks 9–10 Step 1) and may need refinement during manual E2E (Task 13) — this is inherent to scraping JS-rendered SPAs and cannot be eliminated by the plan.
- **Gemini confirmation:** `GEMINI_MODEL` and structured-output shape are centralized in `constants.ts`/`gemini.ts`; confirm the current free-tier model and that `responseMimeType: application/json` behaves as expected during Task 5 / Task 13.
