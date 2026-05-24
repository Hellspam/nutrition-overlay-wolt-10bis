# Nutrition Overlay — Wolt & 10bis

A Chrome extension that adds **estimated** calories + macros (protein / carbs / fat)
to menu items on **wolt.com** and **10bis.co.il**, and updates the totals live as you
pick add-on options in an item's modal.

Estimates come from Google Gemini based on each item's name and description, so they
are **approximate** — every badge is marked `~הערכה` (estimate).

![menu badges and a live-updating modal total]( docs/screenshot.png )
<!-- optional: drop a screenshot at docs/screenshot.png -->

## Install (load unpacked)

1. Download and unzip `nutrition-overlay.zip` (or build from source — see below).
2. Go to `chrome://extensions`, enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the **`dist/`** folder.
4. Open the extension's **Details → Extension options**, paste a **free Gemini API key**
   from <https://aistudio.google.com/apikey>, and click **שמירה** (Save).
5. Open any Wolt or 10bis restaurant menu — calorie/macro badges appear on the items
   automatically, and open an item to see its total update as you select add-ons.

The key is stored locally in your browser (`chrome.storage.local`) and is used only to
call Gemini. Each person who installs the extension uses **their own** free key.

## How it works

- A content script reads each item's name + description from the page and renders a
  badge styled to match the site (RTL Hebrew).
- A background service worker holds the API key and sends item text to Gemini in
  batched, rate-limited requests, then caches every result locally (keyed by a hash of
  the text) so each item is only ever queried once.
- When an item modal is open, the base item and each add-on option are estimated once;
  toggling options recomputes `base + Σ(selected)` instantly client-side — no extra API
  calls per toggle.

## Build from source

```bash
npm install
npm run build       # outputs dist/  (load this unpacked)
npm test            # unit + adapter tests (Vitest)
npm run typecheck   # tsc --noEmit
```

The site-specific DOM selectors live in `src/content/adapters/wolt.ts` and
`src/content/adapters/tenbis.ts` and are tested against real captured markup in
`tests/fixtures/`. If either site changes its markup and badges stop appearing,
re-capture a fixture and adjust that adapter (see the adapter tests for the structure).

## Packaging to share

```bash
npm run build
cd dist && zip -r ../nutrition-overlay.zip . && cd ..
```

Share `nutrition-overlay.zip`; recipients follow the install steps above and add their
own free Gemini key.

## Privacy & scope

- Runs **only** on `*.wolt.com` and `*.10bis.co.il` (enforced in the manifest and in code).
- Sends **only** menu item text (names, descriptions, option labels) to Google Gemini
  to estimate nutrition. No personal data is sent.
- Your API key and the cached estimates stay in your browser's local storage.
- Nutrition values are **estimates** and should not be relied on for medical or dietary
  precision.
