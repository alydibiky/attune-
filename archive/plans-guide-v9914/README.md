# Plans & billing and How to use — the lines removed in v9.9.15 (11 Nov 2026)

Ali: "the billing plan has things from the past, same goes with the how to use". Taken out of the app:
- **How to use**: the "Type with the Attune keyboard" chapter (the keyboard is in `archive/keyboard/`), the old sidebar chapter
  ("8 places: Create · Projects · Home · Students · Money · Health · Daily · Work"), the Home chapter's "Food photo" quick starts,
  the area names "Health & food" / "Learning & study" / "Work & business" / "Create", and the Fit & Food sample.
- **Plans & billing**: Studio pictures, Fit & Food, Business systems and the "Business" column of the comparison (git history of
  `web-src/billing.js` has the lists).

`removed-lines.txt` holds the English lines whose translations stay in every `web-src/i18n-<id>.js`, so bringing one back needs no
new translating (tests/unit/v736langs.test.mjs reads this file).
