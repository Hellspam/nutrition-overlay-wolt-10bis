# Chrome Web Store — Listing Copy

Fill these into the Web Store Developer Dashboard fields. Two languages provided;
the store lets you add localized listings (set default to English or Hebrew).

---

## Extension name
`Nutrition Overlay for Wolt & 10bis`

(Hebrew alt: `ערכים תזונתיים ל-Wolt ו-10bis`)

## Short description (≤132 chars)
**EN:** `See estimated calories + protein/carbs/fat on Wolt & 10bis menu items, updated live as you pick add-ons.`

**HE:** `הצגת קלוריות וחלבון/פחמימות/שומן (משוער) על פריטים ב-Wolt וב-10bis, עם עדכון חי לפי התוספות שבחרתם.`

## Single-purpose description (required by the store)
`This extension has a single purpose: to display estimated nutritional values for food items on the Wolt and 10bis ordering websites.`

## Category
`Shopping` (alternatively `Productivity`).

## Language
English + Hebrew.

---

## Detailed description

### English
```
Curious how many calories are in that order? Nutrition Overlay adds estimated
calories and macros (protein, carbs, fat) right inside the item window on Wolt
and 10bis.

• Open any dish and tap "Calculate nutrition" — no clutter until you ask for it.
• Pick your add-ons (fries, rice, extras) and the total updates instantly.
• Results are cached, so each item is only looked up once.
• Works on wolt.com and 10bis.co.il, with a right-to-left Hebrew interface.

How it works: the dish text is sent to Google's Gemini AI to estimate nutrition.
You use your own free Gemini API key (entered once in the extension's options),
which is stored only in your browser. No accounts, no tracking, no servers.

Note: values are AI estimates and approximate — not a substitute for official
nutrition information or medical advice.
```

### Hebrew
```
רוצים לדעת כמה קלוריות יש בהזמנה? התוסף מציג קלוריות וערכים תזונתיים משוערים
(חלבון, פחמימות, שומן) ישירות בחלון הפריט ב-Wolt וב-10bis.

• פותחים מנה ולוחצים "חשב ערכים תזונתיים" — שום דבר לא מופיע עד שמבקשים.
• בוחרים תוספות (צ'יפס, אורז, תוספות בתשלום) והסכום מתעדכן מיד.
• התוצאות נשמרות במטמון, כך שכל פריט נבדק פעם אחת בלבד.
• עובד ב-wolt.com וב-10bis.co.il, בממשק עברית מימין לשמאל.

איך זה עובד: הטקסט של המנה נשלח ל-Gemini של גוגל להערכת הערכים. משתמשים במפתח
Gemini חינמי משלכם (מוזן פעם אחת בהגדרות התוסף) שנשמר רק בדפדפן שלכם. ללא חשבון,
ללא מעקב, ללא שרתים.

לתשומת לבכם: הערכים הם הערכות AI ומשוערים בלבד — אינם תחליף למידע תזונתי רשמי או
לייעוץ רפואי.
```

---

## Privacy practices tab (what to declare)

- **Single purpose:** see above.
- **Permission justifications:**
  - `storage` — to save your Gemini API key and cache nutrition estimates locally.
  - Host `*.wolt.com` / `*.10bis.co.il` — to read menu item text and render the
    nutrition widget on those sites only.
  - Host `generativelanguage.googleapis.com` — to call the Google Gemini API for
    the estimates.
- **Remote code:** None. All code is bundled in the package; nothing is loaded or
  executed from a remote source.
- **Data usage disclosures:** Check "Website content" (menu item text) is sent to a
  third party (Google Gemini) for the extension's core feature. No data is sold or
  used for purposes unrelated to the single purpose. No personal/financial/health
  data, location, or web history is collected.
- **Privacy policy URL:** host `PRIVACY.md` (e.g. GitHub Pages or a Gist) and paste
  its URL here.

## Assets checklist for the dashboard
- Store icon: `icons/icon-128.png` (128×128). ✅ included in the package.
- At least one screenshot: 1280×800 or 640×400 (capture the card on a real menu).
- (Optional) small promo tile 440×280.

## Visibility recommendation
Set to **Unlisted** for sharing with colleagues — passes review, installs via link
with auto-updates, but is not publicly searchable. Switch to **Public** later if you
want it discoverable.
