import { hashText } from '../../core/hash'
import type { MenuItem, ModalOption } from '../../shared/types'
import type { SiteAdapter } from './types'

const ITEM = '[class*="DishTextContainer-"]'
const NAME = '[class*="DishName-"]'
const DESC = '[class*="DishDescription-"]'
const PRICE = '[class*="DishPrice-"]'

function text(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function optionLabel(input: HTMLInputElement): string {
  // The input is a sibling of its label inside CheckboxWrapper-*, NOT nested in label.
  // Walk up to the CheckboxWrapper-* or ComponentContainer-* and find the label-text span.
  const wrap = input.closest('[class*="CheckboxWrapper-"], [class*="ComponentContainer-"]')
  if (wrap) {
    const labelText = wrap.querySelector<Element>('[data-id="label-text"]')
    if (labelText) return text(labelText)
    // Fallback: find associated label via for/id
    if (input.id) {
      const lbl = input.ownerDocument.querySelector(`label[for="${CSS.escape(input.id)}"]`)
      if (lbl) return text(lbl)
    }
  }
  // Last resort: find label by for/id directly
  if (input.id) {
    const lbl = input.ownerDocument.querySelector(`label[for="${CSS.escape(input.id)}"]`)
    const host = lbl?.querySelector('[data-id="label-text"]') ?? lbl
    if (host) return text(host)
  }
  return ''
}

export const tenbisAdapter: SiteAdapter = {
  matches: (host) => /(^|\.)10bis\.co\.il$/.test(host),
  observeRoot: () => document.body,

  findItems(root) {
    const items: MenuItem[] = []
    for (const card of root.querySelectorAll<HTMLElement>(ITEM)) {
      const name = text(card.querySelector(NAME))
      if (!name) continue
      const description = text(card.querySelector(DESC))
      const priceText = text(card.querySelector(PRICE))
      items.push({ id: hashText(name + '\n' + description), name, description, priceText, anchor: card })
    }
    return items
  },

  findOpenModal(root) {
    return root.querySelector<HTMLElement>('[data-id="dialog-container"]')
  },

  findModalOptions(modalRoot) {
    const opts: ModalOption[] = []
    for (const input of modalRoot.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]')) {
      const label = optionLabel(input)
      if (label) opts.push({ label, input })
    }
    return opts
  },

  getModalTotalAnchor(modalRoot) {
    return modalRoot.querySelector<HTMLElement>('[data-test-id="submitDishBtn"]')
  },
}
