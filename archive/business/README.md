# Business — archived 4 Nov 2026 (v9.1) → the separate product "Attune Business"

Ali, 4 Nov 2026: "business, because I will make it in Attune Business."
Everything for companies: the ERP builder (tables you reshape, deep templates, Insights, client portal, the business website /
Windows program), **Books** (invoices, purchases, stock, VAT, e-invoice ETA, reports), **Shop / POS**, the catalogue,
**Fleet & rentals** (Ali's crane + warehouse programs: jobs, cheques, Store with reference codes, profit per crane, the desk,
trade, orders from WhatsApp), **Site reports**, the **Crane toolkit** (load charts, ground, slings, wind, lift plan).

## What is here
- `web-src/` — biz-*, books-*, erp-*, shop*, catalogue, crane*, liftplan, fleet-ui / fleet-desk* / fleet-order / fleet-portal /
  fleet-pro-ui / fleet-trade-ui, site-ui, sitereport, yusr-to-books (moved with git mv)
- `build/` — site-entry.jsx and site-shell.html (the business website template; build.sh step 2b was removed)
- `attune-routes.jsx.txt` — the screens for modes "business", "crane", "fleet" (equipment health) and "field" (site reports)
- `tests/` — its unit and browser tests

## What stayed in the app ON PURPOSE (data safety)
- `web-src/fleet.js`, `fleet-store.js`, `fleet-pro.js`, `fleet-trade.js`, `industry.js`: the Fleet DATA layer only — no screen uses
  it. Ali's own crane/warehouse records stay on his phone and keep going into backups and Wi-Fi / Drive sync
  (sync-ui.jsx `fleetSyncExtra`), so nothing is lost before Attune Business exists. Today / Missions no longer read it.
- Books / ERP data (IndexedDB / localStorage) is untouched on every phone.
- The small helpers kept parts borrowed now live in kept files: `dash-kit.jsx` (Bars, SeeAll), `share-pdf.js` (sharePdf),
  `licence.js` (the Pro-code public key, jsonFrom).

## To bring Business back (into Attune, or to start Attune Business from it)
1. `git mv archive/business/web-src/* web-src/`; `git mv archive/business/build/* web-src/build/`; tests back to tests/ and tests/unit/.
2. Remove "business", "fleet", "fleet-rentals", "field", "crane" from `web-src/removed.js`.
3. attune.jsx: imports `CraneToolkit` (crane-ui.jsx), `BusinessApp` (biz-ui.jsx), `MicButton, SitePhotos` (site-ui.jsx),
   `loadBooks, saveBooks` (books-store.js), `invoicesToBooks` (yusr-to-books.js), `SELLER, setTestingOpen` (erp.js) and the
   `setTestingOpen(testingPro())` line; paste the routes from `attune-routes.jsx.txt`; restore the MORE_GROUPS line
   `["Business (add-on)", ["business", "field", "fleet"]]`, the Home command "Fleet & rentals" (`usesFleet()`), the WhatsApp crane
   request → Fleet hand-off, the Plans page "Running a company? See Business" link, Money → More → Invoices, and the one-time
   "Money's invoices → Books" copy — all visible in git history at the commit "Archive Studio and Business".
4. home-ui.jsx / missions-ui.jsx: `loadFleet()` again (Today's Fleet line and cheques; Missions' fleet goals).
5. build.sh: step 2b (the business website) and its assembly into www/business-site.html.
6. `bash web-src/build.sh` and run all tests.
