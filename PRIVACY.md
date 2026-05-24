# Privacy Policy — Nutrition Overlay (Wolt & 10bis)

_Last updated: 2026-05-24_

This Chrome extension adds **estimated** nutrition values (calories + macros) to
menu items on `wolt.com` and `10bis.co.il`. This policy explains exactly what data
it handles. The extension is provided as-is, free of charge.

## What the extension does with data

When you open a menu item and click **"Calculate nutrition"**, the extension sends
the item's **text only** — its name, description, and the labels of its add-on
options (e.g. "צ'יפס", "חומוס") — to the **Google Gemini API** to estimate the
nutrition for that item. That is the only data ever transmitted.

## What is NOT collected or sent

The extension does **not** collect, transmit, or store any of the following:

- Personal information (name, email, address, phone).
- Account, login, payment, or order information.
- Browsing history or activity on any site other than the menu text described above.
- Analytics, telemetry, advertising identifiers, or tracking of any kind.

There is no server operated by this extension. No data is sent anywhere except the
Google Gemini API call described above.

## Data stored on your device

The following are stored **locally in your browser only** (via `chrome.storage.local`)
and never leave your device:

- **Your Gemini API key**, which you enter yourself in the extension's options. It is
  used solely to authenticate your own requests to Google.
- **Cached nutrition estimates**, keyed by a hash of the item text, so each item is
  only sent to Gemini once.

You can clear this at any time by removing the extension or clearing its storage.

## Third-party processing (Google Gemini)

Menu item text is processed by Google's Gemini API under your own API key. Google's
handling of that data is governed by Google's terms and privacy policy:

- https://ai.google.dev/gemini-api/terms
- https://policies.google.com/privacy

## Scope

The extension runs only on `wolt.com` and `10bis.co.il`. It does not run on, read, or
affect any other website.

## Changes

If this policy changes, the "Last updated" date above will be revised.

## Contact

Questions: <add your email or GitHub issues link here>.
