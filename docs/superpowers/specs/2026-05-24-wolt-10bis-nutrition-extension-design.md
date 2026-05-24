# Nutrition Overlay Extension — Design

**Date:** 2026-05-24
**Status:** Approved (pending spec review)

## Purpose

A Chrome extension that adds **estimated** nutritional values to food items on
`10bis.co.il` and `wolt.com`. For each menu item it reads the item's name and
description, asks a free LLM for estimated nutrition, and renders a small badge
on the item — styled to match the host site. When an item's modal is open and
the user selects add-ons (e.g. rice, fries), the displayed totals update live.

The extension is for personal use first, with the intent to share it with
colleagues via Slack (distributed as a zip, loaded unpacked).

## Scope

**In scope**
- Works only on `*.10bis.co.il` and `*.wolt.com`.
- Per-item estimate of **calories + macros** (protein, carbs, fat).
- Automatic analysis of visible menu items on page load (batched, cached).
- Live recomputation of totals as add-on options are toggled in an item modal.
- Per-user Gemini API key entered via an options page.
- Badge styled to match each host site (RTL Hebrew, site fonts/colors), with a
  subtle `~est.` marker signalling estimates.

**Out of scope (for now)**
- Persisting/exporting nutrition history or a daily total across items.
- Any server/backend we host. Everything runs in the extension + Gemini.
- Browsers other than Chrome (MV3 Chromium). Cross-browser is a later option.
- Chrome Web Store publishing (zip + "Load unpacked" is the distribution model).

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| LLM provider | **Google Gemini** (Flash, free tier) | Genuine free tier, strong Hebrew, JSON output. |
| Detail level | **Calories + macros** (cal, protein_g, carbs_g, fat_g) | Useful without over-speculating on many fields. |
| Trigger | **Auto on page load**, batched + cached | Matches the "values just appear" UX; cache avoids re-querying. |
| Language/build | **TypeScript + Vite + `@crxjs/vite-plugin`** | Type safety across two adapters; standard MV3 tooling. |
| Data source | **DOM scraping** (both sites) | Live add-on selection state is inherently a DOM concern; read+render share one node. See note below. |
| API key | **Per-user**, stored in `chrome.storage.local`, entered via options page | Free Gemini keys are personal quota; can't share one key. |
| Distribution | **Zip + Load unpacked** (ship built `dist/`) | Lowest friction for internal Slack sharing. |

### Why DOM scraping (not the structured JSON)

Verification (see Appendix) showed both sites expose structured menu JSON
(Wolt embeds it in the initial HTML; 10bis loads it via `NextApi/GetRestaurantMenu`).
However, the core requirement — **update totals when an add-on is selected** —
depends on *live selection state* (which checkbox is checked right now), which
only exists in the DOM. The structured JSON is static menu data and says nothing
about current selections. Since the modal DOM must be read for selection state
regardless, reading the option labels from the same place keeps one source of
truth and avoids a layer matching JSON records to DOM inputs. DOM scraping is
therefore at least as capable for the add-on feature and simpler overall.

## Architecture & Components

Manifest V3 extension, all TypeScript, bundled by Vite + `@crxjs/vite-plugin`.

- **`manifest.json`** — restricts host permissions + content-script matches to
  `*://*.10bis.co.il/*` and `*://*.wolt.com/*` only. Declares the background
  service worker and the options page.
- **Content script** = shared **core** + a per-site **adapter**:
  - **Core** (site-agnostic): cache, request queue, rendering helpers, the
    `base + Σ(options)` summing, the MutationObserver wiring.
  - **Adapters** (`wolt.ts`, `tenbis.ts`): behind a shared `SiteAdapter`
    interface. Each knows how to find menu cards, extract `{name, description,
    priceText}`, locate the injection node, and find modal option rows
    (label + input). This is the only site-specific code.
- **Background service worker** — owns the Gemini API key and all Gemini calls.
  Receives item texts from the content script, batches them, calls Gemini,
  validates + caches results, returns them. Centralizing keeps the key out of
  page context and makes rate-limiting one place.
- **Options page** — paste box for the Gemini key + a "Get a free key here →"
  link; stored in `chrome.storage.local`.
- **Local cache** (`chrome.storage.local`) — keyed by hash of `name+description`
  (and option label), with a `schemaVersion` field for invalidation.

### `SiteAdapter` interface (sketch)

```ts
interface MenuItem {
  id: string;            // stable-ish key derived from name+description
  name: string;
  description: string;
  priceText: string;
  anchor: HTMLElement;   // where the badge is injected
}

interface ModalOption {
  label: string;
  input: HTMLInputElement; // the checkbox/radio to watch
}

interface SiteAdapter {
  matches(): boolean;
  findItems(): MenuItem[];
  findModalOptions(modalRoot: HTMLElement): ModalOption[];
  getModalTotalAnchor(modalRoot: HTMLElement): HTMLElement | null;
  observeRoot(): HTMLElement;     // node to attach the MutationObserver to
}
```

## Data Flow

1. **Site detect + adapter load.** Content script checks hostname, picks the
   adapter.
2. **Discover cards.** Adapter extracts `{name, description, priceText}` + the
   injection anchor per card. A debounced `MutationObserver` catches lazy-loaded
   cards and SPA route changes.
3. **Cache check.** Hash `name+description` → look up `chrome.storage.local`.
   Hits render immediately.
4. **Queue misses → service worker.** Batched (~10–15 items/call) through a
   rate-limit-aware queue (Gemini free tier ≈ 15 req/min). Worker requests JSON
   `{calories, protein_g, carbs_g, fat_g}` per item, validates, caches, returns.
5. **Render base badge.** Inject a nutrition line into each card, styled to the
   site (RTL, fonts/colors), with a subtle `~est.` marker.
6. **Modal / add-ons.** On modal open (observer), adapter finds option rows.
   Each option label is estimated once (same cache+queue path). `change`
   listeners recompute `base + Σ(selected)` and update the modal total
   **client-side, instantly** — no new API calls per toggle.

## Error Handling & Edge Cases

- **No API key** → one-time "Set your free Gemini key →" prompt (links to
  options page) instead of silent failure.
- **API / rate-limit errors** → exponential backoff in the queue; on persistent
  failure show a subtle "couldn't estimate" state on affected cards only.
- **Bad/parse-fail LLM output** → validate against the expected schema; discard
  and mark that item failed (never render garbage).
- **DOM drift** → if selectors match nothing, stay silent (no crashes); failures
  are isolated per-card.
- **Cache invalidation** → keyed by text hash + `schemaVersion`; bump version to
  invalidate when the prompt/shape changes.

## Testing Approach

- **Unit-testable core (pure functions; Vitest):** text hashing, cache get/set,
  rate-limit queue, Gemini response parsing/validation, `base + Σ(options)`
  summing.
- **Adapters:** thin; tested against **saved HTML fixtures** (real Wolt/10bis
  card + modal snippets) via jsdom, so selector logic is verifiable without a
  live browser.
- **Gemini client:** mocked in tests; a small real-call smoke script kept
  separate for manual sanity checks.
- **Manual E2E:** load unpacked, verify on a live Wolt page and a live 10bis
  page (badges appear; modal toggles update totals). Final selectors are
  confirmed here against rendered DOM.

## Risks & Open Items

- **Estimates are approximate.** The LLM guesses from short text; the `~est.`
  marker sets expectations. Acceptable for the stated goal.
- **Selector fragility.** Both sites use generated class names; adapters must use
  resilient selectors (structure/roles/text) and degrade gracefully. Final
  selectors require live-DOM inspection during implementation (cannot be derived
  from `curl`, since both render client-side).
- **Rate limits.** Free Gemini tier (~15 req/min). Batching + caching keep us
  under it for typical menus; the queue throttles bursts.
- **Sending data to Google.** Item descriptions are sent to Gemini. Documented in
  the options page; only menu text (no personal data) is sent.
- **ToS.** The extension reads on-screen content and adds an overlay; it does not
  call the sites' private APIs.

## Appendix — Verification Findings (2026-05-24)

- **10bis** (`https://www.10bis.co.il/`): React SPA, ~12 KB shell with `id="root"`,
  bundles from `cdn.10bis.co.il`. Menu loads at runtime via
  `POST https://www.10bis.co.il/NextApi/GetRestaurantMenu` (returns 200).
- **Wolt** (`https://wolt.com/.../restaurant/<slug>`): SSR shell (~1.5 MB) that
  **embeds the full menu** in `<script type="application/json" class="query-state">`
  (React Query dehydrated state) — names, descriptions, prices, and `options`
  (add-ons, e.g. `"בחרו סוג אורז"`). Discovery API:
  `https://restaurant-api.wolt.com/v1/pages/restaurants?lat=&lon=`.
- Conclusion: both expose structured data, but live add-on selection state is
  DOM-only → DOM scraping chosen.
