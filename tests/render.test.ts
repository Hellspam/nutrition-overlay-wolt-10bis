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
