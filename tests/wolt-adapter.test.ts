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

  it('reads the modal item name from the h2', () => {
    const doc = load('wolt-modal.html')
    const modal = woltAdapter.findOpenModal(doc) ?? doc.body
    const item = woltAdapter.getModalItem(modal as HTMLElement)
    expect(item?.name.length).toBeGreaterThan(0)
  })
})
