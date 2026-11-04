# Fit & Food, Food photo, Cycle, Health page — archived 4 Nov 2026 (v9.1) → the separate product "Attune Fit"

Ali, 4 Nov 2026 (after "can you guarantee Attune Fit will be better than Yazio?"): start Attune Fit as its own app.
What makes it different from Yazio (to prove with real users): Egyptian / Arab food as it is eaten, logging by one sentence or voice
in Egyptian Arabic / Franco, the plate photo read on the phone, the meal's cost in Money, Ramadan, offline, family health.

## What is here
- `web-src/` (git mv): fit-ui.jsx, fitlook*.js(x), fit-summary*.js(x), fitplus-ui.jsx, fitphoto.js, fitclip.js, fitdb.js, fitmicro.js,
  fitcoach.js, fityazio.js, fitamount.js, fit-recipegen.js, foodpack.js, cycle.jsx, cycletemp.js, health-ui.jsx, health-calm-ui.jsx,
  health-report.js
- `attune-routes.jsx.txt` — the screens for modes "fit", "cycle", "health" and the Cycle state of the App component
- `tests/` — its browser tests; `tests/unit/` — its unit tests

## What stayed in the app ON PURPOSE
- The food READERS (`fit.js`, `fitread.js`, `fit-foods.js`, `fit-cuisines.js`, `fit-recipes2.js`, `fithome.js`, `fitplus.js`, `vitals.js`):
  Chat still reads a priced meal's name into Money ("koshary for lunch, 80 pounds" → 85 EGP «Koshari»), prayer times use the city list
  in fitplus.js, the morning card can read vitals. `doit.js understandAll()` is the full reader (meals, water, weight, workouts, sleep);
  `understand()` drops those kinds while `FIT_ARCHIVED = true`.
- Everyone's Fit / Cycle data stays on the phone, untouched (attune:fit:v1, the cycle store) — Attune Fit can read it.
- Android: the plate / barcode camera, Health Connect and Huawei Health reading stay compiled but nothing in Attune opens them.

## To bring it back
1. `git mv archive/fit/web-src/* web-src/`; tests back to tests/ and tests/unit/.
2. Remove "fit", "food-photo", "cycle", "health" from `web-src/removed.js`; set `FIT_ARCHIVED = false` in doit.js.
3. attune.jsx: imports `FitApp` (fit-ui.jsx), `HealthPage` (health-ui.jsx), `CycleTab, cycleLoad, cycleSave, looksLikePeriodLog,
   parsePeriodText, applyPeriodLog` (cycle.jsx); the routes and the Cycle state from `attune-routes.jsx.txt` (replacing
   `const cycleOn = false, enableCycle = () => {};`); `openFit` in the chat api, `isPeriodLog: looksLikePeriodLog` + `logPeriod`, the
   period branch of doFromHome and runSmart; SIDE_PLACES "health"; home-ui.jsx `FitToday` and the fit/targets read; chat.jsx's fit chip
   works again once `api.openFit` exists. See git history at the commit "Archive Fit & Food".
4. tests/bank/route.mjs and the doit tests use `understandAll` — switch back to `understand` if wanted. Build and run all tests.
