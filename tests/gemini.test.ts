import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildRequestBody, parseResponse, callGemini } from '../src/background/gemini'
import { GEMINI_THINKING_BUDGET } from '../src/shared/constants'

const items = [
  { id: 'a', name: 'פלאפל בפיתה', description: 'עם חומוס וסלט' },
  { id: 'b', name: 'תוספת בטטה', description: '' },
]

describe('buildRequestBody', () => {
  it('asks for JSON and includes every item id in the prompt', () => {
    const body = buildRequestBody(items)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(GEMINI_THINKING_BUDGET)
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
