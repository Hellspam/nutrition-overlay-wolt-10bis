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

export function renderNoKeyPrompt(): void {
  if (document.getElementById('nutrition-overlay-nokey')) return
  const bar = document.createElement('div')
  bar.id = 'nutrition-overlay-nokey'
  bar.setAttribute('dir', 'rtl')
  bar.textContent = 'תוסף ערכים תזונתיים: הגדירו מפתח Gemini חינמי בהגדרות התוסף ←'
  Object.assign(bar.style, {
    position: 'fixed', bottom: '12px', insetInlineStart: '12px', zIndex: '2147483647',
    background: '#222', color: '#fff', padding: '8px 12px', borderRadius: '8px',
    fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
  } as Partial<CSSStyleDeclaration>)
  bar.addEventListener('click', () => chrome.runtime.openOptionsPage())
  document.body.appendChild(bar)
}
