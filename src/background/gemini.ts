import { GEMINI_ENDPOINT } from '../shared/constants'
import type { Nutrition } from '../shared/types'

export interface GeminiItem { id: string; name: string; description: string }

interface RequestBody {
  contents: { parts: { text: string }[] }[]
  generationConfig: {
    responseMimeType: string
    temperature: number
    thinkingConfig: { thinkingBudget: number }
  }
}

export function buildRequestBody(items: GeminiItem[]): RequestBody {
  const list = items
    .map((it) => `- id="${it.id}": ${it.name}${it.description ? ' — ' + it.description : ''}`)
    .join('\n')
  const prompt =
    `You are a nutrition estimator. For each food item below (text may be Hebrew), ` +
    `estimate the nutrition for ONE standard serving as typically sold. ` +
    `Return ONLY a JSON array, one object per item, in this exact shape (match by id):\n` +
    `[{"id": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}]\n` +
    `All numbers are per single serving, non-negative, grams for macros. No prose, no markdown.\n\n` +
    `Items:\n${list}`
  return {
    contents: [{ parts: [{ text: prompt }] }],
    // thinkingBudget:0 disables Gemini "thinking" — clean JSON in ~1.5s instead of ~15s.
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 0 },
    },
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
