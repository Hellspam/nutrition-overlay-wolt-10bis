import type { SiteAdapter } from './adapters/types'
import type { EstimateResponse, MenuItem, Nutrition } from '../shared/types'
import { renderBadge, renderError, BADGE_CLASS } from './render'
import { sumNutrition } from '../core/nutrition'
import { hashText } from '../core/hash'

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

export interface BaseRef { id: string; name: string; description: string }

export function resolveModalBase(
  adapter: SiteAdapter,
  modal: HTMLElement,
  items: MenuItem[],
): BaseRef | null {
  const m = adapter.getModalItem(modal)
  if (m?.name) {
    const match = items.find((it) => it.name === m.name)
    if (match) return { id: match.id, name: match.name, description: match.description }
    return { id: hashText(m.name + '\n' + m.description), name: m.name, description: m.description }
  }
  const guess = items.find((it) => modal.textContent?.includes(it.name)) ?? items[0]
  return guess ? { id: guess.id, name: guess.name, description: guess.description } : null
}

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
