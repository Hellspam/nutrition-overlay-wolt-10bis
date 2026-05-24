import type { Nutrition } from '../shared/types'

export const BADGE_CLASS = 'nutrition-overlay-badge'
const TOTAL_CLASS = BADGE_CLASS + '-total'
const BTN_CLASS = BADGE_CLASS + '-btn'
const HOST_CLASS = BADGE_CLASS + '-host'
const STYLE_ID = 'nutrition-overlay-style'

// A small inline leaf mark — no external assets / webfonts, so nothing to be
// blocked by a strict page CSP or to add latency.
const LEAF =
  '<svg class="no-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
  '<path fill="currentColor" d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20' +
  'C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/></svg>'

// One self-contained stylesheet. Both wolt.com and 10bis.co.il permit inline
// <style> (style-src is unrestricted / 'unsafe-inline'), and giving the widget
// its own opaque surface keeps it legible on light OR dark host menus.
const CSS = `
.${HOST_CLASS}, .${HOST_CLASS} *, .${TOTAL_CLASS}, .${TOTAL_CLASS} *, .${BTN_CLASS}, .${BTN_CLASS} * {
  box-sizing: border-box; margin: 0; padding: 0;
  font-family: ui-rounded, "SF Pro Rounded", -apple-system, system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}
/* In-flow panel, right-aligned, inserted above the options (below the description)
   so it never overlaps the title, stepper, or submit button. */
.${HOST_CLASS} {
  display: block; width: 100%; max-width: 300px;
  margin: 12px 0 12px auto; /* margin-left:auto hugs the right edge, any page dir */
}
.${TOTAL_CLASS} {
  direction: rtl; display: block; position: relative; overflow: hidden; text-align: right;
  padding: 13px 16px 11px;
  background: #ffffff; color: #15241d;
  border: 1px solid rgba(20,45,33,.08); border-radius: 16px;
  box-shadow: 0 14px 34px -12px rgba(16,90,60,.36), 0 2px 6px -2px rgba(20,45,33,.14);
  line-height: 1.2;
  animation: no-pop .28s cubic-bezier(.2,.85,.25,1) both;
}
.${TOTAL_CLASS}::before {
  content: ""; position: absolute; top: 0; bottom: 0; inset-inline-start: 0; width: 4px;
  background: linear-gradient(180deg, #2bb673, #13794e);
}
.${TOTAL_CLASS} .no-cal { display: flex; align-items: baseline; gap: 7px; }
.${TOTAL_CLASS} .no-cal-num {
  font-size: 30px; font-weight: 800; letter-spacing: -1px; color: #13794e;
  font-variant-numeric: tabular-nums; transform-origin: right center;
}
.${TOTAL_CLASS} .no-cal-num.no-pulse { animation: no-pulse .4s ease; }
.${TOTAL_CLASS} .no-cal-unit { font-size: 12px; font-weight: 600; color: #728178; letter-spacing: .2px; }
.${TOTAL_CLASS} .no-macros { display: flex; gap: 7px; margin-top: 11px; }
.${TOTAL_CLASS} .no-macro {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 4px; background: #f4f8f5; border-radius: 11px;
}
.${TOTAL_CLASS} .no-row { display: flex; align-items: baseline; gap: 2px; }
.${TOTAL_CLASS} .no-macro-val { font-size: 15px; font-weight: 700; color: #1c2e26; font-variant-numeric: tabular-nums; }
.${TOTAL_CLASS} .no-macro-unit { font-size: 10px; font-weight: 600; color: #9aa8a0; }
.${TOTAL_CLASS} .no-macro-lbl { font-size: 10.5px; font-weight: 600; color: #728178; display: flex; align-items: center; gap: 4px; }
.${TOTAL_CLASS} .no-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.${TOTAL_CLASS} .no-macro--p .no-dot { background: #e4572e; }
.${TOTAL_CLASS} .no-macro--c .no-dot { background: #3e84c4; }
.${TOTAL_CLASS} .no-macro--f .no-dot { background: #e0a325; }
.${TOTAL_CLASS} .no-foot { margin-top: 9px; font-size: 10px; color: #9aa8a0; display: flex; align-items: center; gap: 5px; }
.${TOTAL_CLASS} .no-foot .no-ico { opacity: .7; }
.${BTN_CLASS} {
  direction: rtl; display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 12px 16px;
  font-size: 13.5px; font-weight: 700; color: #fff; cursor: pointer; letter-spacing: .2px;
  background: linear-gradient(135deg, #28a86e, #13794e);
  border: 0; border-radius: 13px;
  box-shadow: 0 10px 22px -8px rgba(19,121,78,.7);
  transition: transform .15s ease, box-shadow .15s ease, filter .15s ease;
}
.${BTN_CLASS} .no-ico { flex: none; }
.${BTN_CLASS}:hover { transform: translateY(-1px); box-shadow: 0 14px 26px -8px rgba(19,121,78,.8); filter: brightness(1.06); }
.${BTN_CLASS}:active { transform: translateY(0); filter: brightness(.95); }
.${BTN_CLASS}:disabled { cursor: default; opacity: .92; transform: none; filter: saturate(.85); }
.${BTN_CLASS} .no-spin {
  width: 15px; height: 15px; flex: none; border-radius: 50%;
  border: 2px solid rgba(255,255,255,.45); border-top-color: #fff;
  animation: no-rot .7s linear infinite;
}
@keyframes no-pop { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes no-pulse { 0% { transform: scale(1); } 35% { transform: scale(1.14); } 100% { transform: scale(1); } }
@keyframes no-rot { to { transform: rotate(360deg); } }
`

export function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  ;(document.head || document.documentElement).appendChild(style)
}

/**
 * The container for our widget: a right-aligned block inserted in-flow just before
 * `anchor` (the options section), so it sits below the description and above the
 * options without overlapping any modal content. Created once per modal.
 */
export function ensureHost(modal: HTMLElement, anchor: HTMLElement): HTMLElement {
  ensureStyles()
  let host = modal.querySelector<HTMLElement>('.' + HOST_CLASS)
  if (!host) {
    host = document.createElement('div')
    host.className = HOST_CLASS
    host.setAttribute('dir', 'rtl')
    if (anchor.parentElement) anchor.parentElement.insertBefore(host, anchor)
    else modal.appendChild(host)
  }
  return host
}

const CARD_HTML =
  `<div class="no-cal"><span class="no-cal-num" data-no="cal">~0</span><span class="no-cal-unit">קלוריות</span></div>` +
  `<div class="no-macros">` +
  `<div class="no-macro no-macro--p"><span class="no-row"><span class="no-macro-val" data-no="p">0</span><span class="no-macro-unit">ג׳</span></span><span class="no-macro-lbl"><i class="no-dot"></i>חלבון</span></div>` +
  `<div class="no-macro no-macro--c"><span class="no-row"><span class="no-macro-val" data-no="c">0</span><span class="no-macro-unit">ג׳</span></span><span class="no-macro-lbl"><i class="no-dot"></i>פחמ׳</span></div>` +
  `<div class="no-macro no-macro--f"><span class="no-row"><span class="no-macro-val" data-no="f">0</span><span class="no-macro-unit">ג׳</span></span><span class="no-macro-lbl"><i class="no-dot"></i>שומן</span></div>` +
  `</div>` +
  `<div class="no-foot">${LEAF}<span>הערכת AI · ערכים משוערים</span></div>`

/** Create or update the nutrition total card inside `container` (the floating host). */
export function renderTotalCard(container: HTMLElement, n: Nutrition): void {
  ensureStyles()
  let el = container.querySelector<HTMLElement>('.' + TOTAL_CLASS)
  if (!el) {
    el = document.createElement('div')
    el.className = TOTAL_CLASS
    el.setAttribute('dir', 'rtl')
    el.innerHTML = CARD_HTML
    container.appendChild(el)
  }
  const cal = el.querySelector<HTMLElement>('[data-no="cal"]')!
  cal.textContent = '~' + n.calories
  el.querySelector<HTMLElement>('[data-no="p"]')!.textContent = String(n.protein_g)
  el.querySelector<HTMLElement>('[data-no="c"]')!.textContent = String(n.carbs_g)
  el.querySelector<HTMLElement>('[data-no="f"]')!.textContent = String(n.fat_g)
  // Restart the pulse so the calorie figure flicks each time the total changes.
  cal.classList.remove('no-pulse')
  void cal.offsetWidth
  cal.classList.add('no-pulse')
}

export function createNutritionButton(): HTMLButtonElement {
  ensureStyles()
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = BTN_CLASS
  btn.setAttribute('dir', 'rtl')
  btn.innerHTML = `${LEAF}<span class="no-btn-label">חשב ערכים תזונתיים</span>`
  return btn
}

export function markButtonLoading(btn: HTMLButtonElement): void {
  btn.disabled = true
  btn.innerHTML = `<span class="no-spin"></span><span class="no-btn-label">מחשב…</span>`
}

export function markButtonError(btn: HTMLButtonElement): void {
  btn.disabled = false
  btn.innerHTML = `${LEAF}<span class="no-btn-label">לא הצלחנו — נסו שוב</span>`
}

export function markButtonRateLimited(btn: HTMLButtonElement): void {
  btn.disabled = false
  btn.innerHTML = `${LEAF}<span class="no-btn-label">חריגה ממכסת Gemini — נסו מאוחר יותר</span>`
}

// --- Menu-grid badge (kept for a possible future per-card mode; not auto-rendered) ---

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
  badge.textContent = 'ערכים תזונתיים — לא זמין'
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
    background: '#13794e', color: '#fff', padding: '10px 14px', borderRadius: '12px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    boxShadow: '0 10px 24px -8px rgba(19,121,78,.6)',
  } as Partial<CSSStyleDeclaration>)
  bar.addEventListener('click', () => chrome.runtime.openOptionsPage())
  document.body.appendChild(bar)
}
