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
