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
