import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processItems, wireModalButton, resolveModalBase } from '../src/content/orchestrator'
import { BADGE_CLASS } from '../src/content/render'
import type { SiteAdapter } from '../src/content/adapters/types'
import type { MenuItem, ModalOption, Nutrition } from '../src/shared/types'

const N = (c: number): Nutrition => ({ calories: c, protein_g: 1, carbs_g: 1, fat_g: 1 })

function fakeAdapter(items: MenuItem[], options: ModalOption[], modalItem: { name: string; description: string } | null = null): SiteAdapter {
  return {
    matches: () => true,
    observeRoot: () => document.body,
    findItems: () => items,
    findOpenModal: () => document.querySelector('[role="dialog"]'),
    findModalOptions: () => options,
    getModalTotalAnchor: () => document.querySelector('#total'),
    getModalItem: () => modalItem,
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

describe('wireModalButton', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('injects a button and sends nothing until it is clicked', () => {
    document.body.innerHTML = '<div role="dialog"><div id="total"></div></div>'
    const fetchEstimates = vi.fn(async () => ({ ok: true, results: {} }))
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!
    wireModalButton(fakeAdapter([], []), modal, { id: 'BASE', name: 'x', description: '' }, fetchEstimates)
    expect(document.querySelector('.' + BADGE_CLASS + '-btn')).toBeTruthy()
    expect(fetchEstimates).not.toHaveBeenCalled()
  })

  it('on click sends ONE grouped request, then shows + live-updates the total', async () => {
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

    wireModalButton(adapter, modal, { id: 'BASE', name: 'Shawarma', description: '' }, fetchEstimates)
    const btn = document.querySelector<HTMLButtonElement>('.' + BADGE_CLASS + '-btn')!
    expect(btn).toBeTruthy()
    expect(fetchEstimates).not.toHaveBeenCalled()

    btn.click()
    await new Promise((r) => setTimeout(r)) // let the async click handler resolve

    expect(fetchEstimates).toHaveBeenCalledTimes(1)
    expect(fetchEstimates.mock.calls[0][0]).toHaveLength(3) // base + 2 options, ONE grouped request
    expect(document.querySelector('.' + BADGE_CLASS + '-btn')).toBeNull() // button replaced by total

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

describe('resolveModalBase', () => {
  beforeEach(() => { document.body.innerHTML = '<div role="dialog">דיל לאפה שווארמה מיקס</div>' })
  const mk = (name: string): MenuItem => ({ id: 'id:' + name, name, description: '', priceText: '', anchor: document.createElement('div') })

  it('prefers an exact name match over a substring collision', () => {
    const items = [mk('שווארמה'), mk('דיל לאפה שווארמה מיקס')]
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!
    const adapter = fakeAdapter(items, [], { name: 'דיל לאפה שווארמה מיקס', description: '' })
    const base = resolveModalBase(adapter, modal, items)
    expect(base?.name).toBe('דיל לאפה שווארמה מיקס')
    expect(base?.id).toBe('id:דיל לאפה שווארמה מיקס')
  })

  it('derives a base from the modal when no card matches', () => {
    const modal = document.querySelector<HTMLElement>('[role="dialog"]')!
    const adapter = fakeAdapter([], [], { name: 'New Dish', description: 'tasty' })
    const base = resolveModalBase(adapter, modal, [])
    expect(base?.name).toBe('New Dish')
    expect((base?.id.length ?? 0)).toBeGreaterThan(0)
  })
})
