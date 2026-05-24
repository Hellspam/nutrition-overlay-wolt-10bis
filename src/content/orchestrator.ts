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

const ZERO: Nutrition = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

/**
 * Inject a "calculate nutrition" button into an open item modal. Only when the
 * user clicks it do we send ONE grouped request (the base dish + all its options).
 * After it resolves we show the total and update it live as options are toggled —
 * no further API calls. Idempotent per modal.
 */
export function wireModalButton(
  adapter: SiteAdapter,
  modal: HTMLElement,
  base: BaseRef,
  fetchEstimates: FetchEstimates,
): void {
  if ((modal as any).__nutritionWired) return
  ;(modal as any).__nutritionWired = true

  const anchor = adapter.getModalTotalAnchor(modal) ?? modal
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = BADGE_CLASS + '-btn'
  btn.setAttribute('dir', 'rtl')
  btn.textContent = '🔢 חשב ערכים תזונתיים'
  Object.assign(btn.style, {
    display: 'block', width: '100%', margin: '8px 0', padding: '8px 12px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderRadius: '8px',
    border: '1px solid currentColor', background: 'transparent', color: 'inherit',
  } as Partial<CSSStyleDeclaration>)
  if (anchor.parentElement) anchor.parentElement.insertBefore(btn, anchor)
  else anchor.appendChild(btn)

  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = 'מחשב…'

    const options = adapter.findModalOptions(modal)
    const reqItems = [
      { id: base.id, name: base.name, description: base.description },
      ...options.map((o, i) => ({ id: `opt:${i}:${o.label}`, name: o.label, description: '' })),
    ]

    let resp: EstimateResponse
    try {
      resp = await fetchEstimates(reqItems)
    } catch {
      resp = { ok: false, error: 'API_ERROR' }
    }
    if (!resp.ok || !resp.results) {
      btn.disabled = false
      btn.textContent = '🔢 נכשל — נסו שוב'
      return
    }

    const results = resp.results
    const baseN = results[base.id] ?? ZERO
    // Per-option values are fetched once now so toggling is instant (no new calls).
    const optN: (Nutrition | undefined)[] = options.map((o, i) => results[`opt:${i}:${o.label}`])
    btn.remove()

    // The displayed total = base + only the SELECTED options, recomputed on every toggle.
    const recompute = () => {
      const selected = options
        .map((o, i) => (o.input.checked ? optN[i] : undefined))
        .filter((n): n is Nutrition => !!n)
      renderTotal(anchor, sumNutrition([baseN, ...selected]))
    }
    options.forEach((o) => o.input.addEventListener('change', recompute))
    recompute()
  })
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
