import type { Nutrition } from '../shared/types'

export const BADGE_CLASS = 'nutrition-overlay-badge'

function ensureBadge(anchor: HTMLElement): HTMLElement {
  let badge = anchor.querySelector<HTMLElement>('.' + BADGE_CLASS)
  if (!badge) {
    badge = document.createElement('div')
    badge.className = BADGE_CLASS
    badge.setAttribute('dir', 'rtl')
    Object.assign(badge.style, {
      display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
      marginTop: '6px', fontSize: '12px', lineHeight: '1.4', opacity: '0.95',
    } as Partial<CSSStyleDeclaration>)
    anchor.appendChild(badge)
  }
  return badge
}

export function renderBadge(anchor: HTMLElement, n: Nutrition): void {
  const badge = ensureBadge(anchor)
  badge.textContent = ''
  const cal = document.createElement('strong')
  cal.textContent = `${n.calories} קל'`
  const macros = document.createElement('span')
  macros.textContent = `חלבון ${n.protein_g} · פחמ' ${n.carbs_g} · שומן ${n.fat_g}`
  macros.style.opacity = '0.8'
  const est = document.createElement('span')
  est.textContent = '~הערכה'
  est.style.opacity = '0.55'
  est.style.fontSize = '11px'
  badge.append(cal, macros, est)
}

export function renderError(anchor: HTMLElement): void {
  const badge = ensureBadge(anchor)
  badge.textContent = "ערכים תזונתיים — לא זמין"
  badge.style.opacity = '0.5'
}
