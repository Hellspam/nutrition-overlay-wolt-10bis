import { hashText } from '../../core/hash'
import type { MenuItem, ModalOption } from '../../shared/types'
import type { SiteAdapter } from './types'

const ITEM = '[data-test-id="horizontal-item-card"]'
const NAME = '[data-test-id="horizontal-item-card-header"]'
const PRICE = '[data-test-id="horizontal-item-card-price"]'

function text(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function descriptionOf(nameEl: Element | null): string {
  const block = nameEl?.parentElement
  if (!block) return ''
  for (const p of block.querySelectorAll('p')) {
    if (p === nameEl) continue
    const t = text(p)
    if (t && !t.includes('₪')) return t   // skip the price <p>
  }
  return ''
}

function optionRow(input: HTMLInputElement): Element | null {
  // Walk up from input to find the option container whose data-test-id matches
  // "multiselect.<id>" but NOT "multiselect.<id>.checkbox" (which is the input itself)
  let el: Element | null = input.parentElement
  while (el) {
    const tid = el.getAttribute('data-test-id') ?? ''
    if (/^multiselect\.[^.]+$/.test(tid)) return el
    el = el.parentElement
  }
  // Fallback: look for a label ancestor or li/div
  return input.closest('label') ?? input.closest('li, div')
}

export const woltAdapter: SiteAdapter = {
  matches: (host) => /(^|\.)wolt\.com$/.test(host),
  observeRoot: () => document.body,

  findItems(root) {
    const items: MenuItem[] = []
    for (const card of root.querySelectorAll<HTMLElement>(ITEM)) {
      const nameEl = card.querySelector(NAME)
      const name = text(nameEl)
      if (!name) continue
      const description = descriptionOf(nameEl)
      const priceText = text(card.querySelector(PRICE))
      const anchor = (nameEl?.parentElement as HTMLElement | null) ?? card
      items.push({ id: hashText(name + '\n' + description), name, description, priceText, anchor })
    }
    return items
  },

  findOpenModal(root) {
    return root.querySelector<HTMLElement>(
      '[data-test-id="product-modal-container"], [data-test-id="product-modal"]'
    )
  },

  findModalOptions(modalRoot) {
    const opts: ModalOption[] = []
    for (const input of modalRoot.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"], input[type="radio"]'
    )) {
      const row = optionRow(input)
      const label = text(row)
      if (label) opts.push({ label, input })
    }
    return opts
  },

  getModalTotalAnchor(modalRoot) {
    // The "Add to order" submit button sits at the bottom of a fully-loaded modal,
    // so anchoring there places the widget right above it. Returning null when none
    // of these exist signals "modal not ready yet" (Wolt streams the content in after
    // the shell), so the caller retries on a later mutation.
    return (
      modalRoot.querySelector<HTMLElement>('[data-test-id="product-modal.submit"]') ??
      modalRoot.querySelector<HTMLElement>('[data-test-id="product-modal.total-price"]') ??
      modalRoot.querySelector<HTMLElement>('[data-test-id="product-modal.price"]')
    )
  },

  getModalItem(modalRoot) {
    const name = text(modalRoot.querySelector('h2'))
    if (!name) return null
    return { name, description: '' }
  },
}
